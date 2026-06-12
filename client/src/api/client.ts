import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

// Type augmentation for retry flag
declare module "axios" {
  interface InternalAxiosRequestConfig {
    _retry?: boolean;
  }
}

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

// Request interceptor — attach access token
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — silent refresh on 401
// Deduplicates concurrent 401s: only one refresh request fires,
// all waiting requests replay with the new token.
let _refreshPromise: Promise<string> | null = null;

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      try {
        // Reuse in-flight refresh if one is already running
        if (!_refreshPromise) {
          const refreshToken = getRefreshToken();
          if (!refreshToken) return Promise.reject(error);

          _refreshPromise = axios
            .post(`${API_URL}/auth/refresh`, {
              refresh_token: refreshToken,
            })
            .then(({ data }) => {
              setAccessToken(data.access_token);
              setRefreshToken(data.refresh_token);
              return data.access_token as string;
            })
            .finally(() => {
              _refreshPromise = null;
            });
        }

        const newToken = await _refreshPromise;
        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      } catch {
        setAccessToken(null);
        setRefreshToken(null);
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);

// In-memory token storage (never localStorage for access tokens)
let _accessToken: string | null = null;
let _refreshTimerId: ReturnType<typeof setTimeout> | null = null;

const REFRESH_TOKEN_KEY = "refresh_token";

export function setAccessToken(token: string | null) {
  _accessToken = token;
  if (token) {
    scheduleProactiveRefresh(token);
  }
}

export function getAccessToken(): string | null {
  return _accessToken;
}

export function setRefreshToken(token: string | null) {
  if (token) {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

export function getRefreshToken(): string | null {
  return sessionStorage.getItem(REFRESH_TOKEN_KEY);
}

export function clearRefreshTimer() {
  if (_refreshTimerId) {
    clearTimeout(_refreshTimerId);
    _refreshTimerId = null;
  }
}

/**
 * Decode JWT exp claim (no verification — just base64 decode)
 * and schedule a refresh 60s before expiry.
 */
function scheduleProactiveRefresh(accessToken: string) {
  clearRefreshTimer();
  try {
    const payload = JSON.parse(atob(accessToken.split(".")[1]));
    const exp = payload.exp as number;
    const nowSec = Math.floor(Date.now() / 1000);
    const delayMs = (exp - nowSec - 60) * 1000; // 60s before expiry
    if (delayMs <= 0) return; // already close to expiry, interceptor handles it

    _refreshTimerId = setTimeout(async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return;
      try {
        const { data } = await axios.post(
          `${API_URL}/auth/refresh`,
          { refresh_token: refreshToken },
        );
        setAccessToken(data.access_token);
        setRefreshToken(data.refresh_token);
      } catch {
        // Silent failure — 401 interceptor is the fallback
      }
    }, delayMs);
  } catch {
    // Invalid token format — skip proactive refresh
  }
}
