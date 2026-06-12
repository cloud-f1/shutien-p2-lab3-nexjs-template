import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { setAccessToken, setRefreshToken } from "../../api/client";
import { authApi } from "../../api/auth";
import { useAuthStore } from "../../store/authStore";
import { AuthLayout, AuthCard, Banner } from "../../components/ui";

/**
 * OAuth callback page — handles the redirect from the server after
 * a successful OAuth flow. Tokens arrive in the URL hash fragment.
 *
 * Route: /auth/callback#access_token=...&refresh_token=...
 */
export default function OAuthCallbackPage() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const [error, setError] = useState<string | null>(null);
  const processedRef = useRef(false);

  useEffect(() => {
    // Prevent double-processing in React strict mode
    if (processedRef.current) return;
    processedRef.current = true;

    async function processCallback() {
      try {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        // Clean the hash immediately for security
        window.history.replaceState(null, "", window.location.pathname);

        if (!accessToken || !refreshToken) {
          throw new Error("Missing tokens in callback URL");
        }

        setAccessToken(accessToken);
        setRefreshToken(refreshToken);

        const user = await authApi.getCurrentUser();
        setUser(user);

        navigate("/dashboard", { replace: true });
      } catch {
        setError("OAuth sign-in failed. Please try again.");
        setAccessToken(null);
        setRefreshToken(null);
        setTimeout(() => {
          navigate("/signin?error=oauth_failed", { replace: true });
        }, 2000);
      }
    }

    processCallback();
  }, [navigate, setUser]);

  return (
    <AuthLayout>
      <AuthCard title={error ? "Sign-in failed" : "Almost there"}>
        {error ? (
          <Banner variant="error">{error}</Banner>
        ) : (
          <p aria-live="polite" className="text-center text-text-secondary">
            Completing sign-in...
          </p>
        )}
      </AuthCard>
    </AuthLayout>
  );
}
