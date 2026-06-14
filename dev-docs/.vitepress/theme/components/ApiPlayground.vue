<template>
  <div class="api-playground">
    <div class="api-playground-header">
      <span :class="['api-playground-method', `method-${method.toLowerCase()}`]">
        {{ method }}
      </span>
      <span class="api-playground-url">{{ baseUrl }}{{ endpoint }}</span>
      <select v-model="selectedEndpoint" class="api-playground-select" @change="onEndpointChange">
        <option v-for="ep in endpoints" :key="ep.path" :value="ep.path">
          {{ ep.label }}
        </option>
      </select>
    </div>

    <div class="api-playground-body">
      <!-- Base URL config -->
      <div style="margin-bottom: 1rem;">
        <div class="api-playground-label">Base URL (your deployed Next.js app)</div>
        <input
          v-model="baseUrl"
          class="api-playground-input"
          type="text"
          placeholder="https://your-app.zeabur.app"
        />
      </div>

      <!-- Headers -->
      <div v-if="showHeaders" style="margin-bottom: 1rem;">
        <div class="api-playground-label">Authorization Header (optional)</div>
        <input
          v-model="authHeader"
          class="api-playground-input"
          type="text"
          placeholder="Bearer <your-jwt-token>"
        />
      </div>

      <!-- Request body -->
      <div v-if="showBody" style="margin-bottom: 1rem;">
        <div class="api-playground-label">Request Body (JSON)</div>
        <textarea
          v-model="requestBody"
          class="api-playground-textarea"
          spellcheck="false"
        />
      </div>

      <div style="display: flex; align-items: center; gap: 1rem;">
        <button class="api-playground-btn" :disabled="loading" @click="sendRequest">
          {{ loading ? 'Sending...' : 'Send Request' }}
        </button>
        <button
          class="api-playground-btn"
          style="background: transparent; color: var(--vp-c-text-2); border: 1px solid var(--vp-c-border);"
          @click="clearResponse"
        >
          Clear
        </button>
        <a
          v-if="liveAppUrl"
          :href="liveAppUrl"
          target="_blank"
          rel="noopener"
          style="font-size: 0.8rem; color: var(--vp-c-brand-1); font-weight: 600;"
        >
          Try in Live App →
        </a>
      </div>

      <!-- Response -->
      <div v-if="response !== null" style="margin-top: 1rem;">
        <div class="api-playground-label">Response</div>
        <div>
          <span :class="['response-status', responseError ? 'status-error' : 'status-ok']">
            {{ responseStatus }}
          </span>
        </div>
        <pre class="api-playground-response">{{ response }}</pre>
      </div>

      <div v-if="corsNote" style="margin-top: 0.75rem; font-size: 0.8rem; color: var(--vp-c-text-3);">
        Note: CORS must be enabled on the target Next.js app for cross-origin requests. Server Actions
        are not cross-origin callable — use the "Try in Live App" link instead.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const PRESET_ENDPOINTS = [
  {
    path: '/api/health',
    label: 'GET /api/health',
    method: 'GET',
    body: null,
  },
  {
    path: '/api/auth/session',
    label: 'GET /api/auth/session',
    method: 'GET',
    body: null,
  },
  {
    path: '/api/auth/signin',
    label: 'POST /api/auth/signin',
    method: 'POST',
    body: JSON.stringify({ email: 'user@example.com', password: 'User123!' }, null, 2),
  },
]

const props = withDefaults(
  defineProps<{
    defaultEndpoint?: string
    defaultMethod?: string
    defaultBody?: string
    liveAppPath?: string
  }>(),
  {
    defaultEndpoint: '/api/health',
    defaultMethod: 'GET',
    defaultBody: '',
    liveAppPath: '',
  }
)

const baseUrl = ref(
  typeof window !== 'undefined'
    ? (window as Window & { VITEPRESS_API_BASE?: string }).VITEPRESS_API_BASE ?? ''
    : ''
)
const selectedEndpoint = ref(props.defaultEndpoint)
const method = ref(props.defaultMethod)
const requestBody = ref(props.defaultBody)
const authHeader = ref('')
const loading = ref(false)
const response = ref<string | null>(null)
const responseStatus = ref('')
const responseError = ref(false)
const corsNote = ref(false)

const endpoints = PRESET_ENDPOINTS
const endpoint = computed(() => selectedEndpoint.value)
const showBody = computed(() => ['POST', 'PUT', 'PATCH'].includes(method.value))
const showHeaders = ref(true)

const liveAppUrl = computed(() => {
  if (!baseUrl.value && !props.liveAppPath) return ''
  const base = baseUrl.value || 'https://your-app.zeabur.app'
  return base.replace(/\/$/, '') + (props.liveAppPath || selectedEndpoint.value)
})

function onEndpointChange() {
  const ep = endpoints.find((e) => e.path === selectedEndpoint.value)
  if (ep) {
    method.value = ep.method
    requestBody.value = ep.body ?? ''
  }
}

async function sendRequest() {
  if (!baseUrl.value) {
    response.value = 'Please enter a base URL pointing to your deployed Next.js app.'
    responseStatus.value = 'Error'
    responseError.value = true
    return
  }

  loading.value = true
  response.value = null
  responseError.value = false
  corsNote.value = false

  const url = baseUrl.value.replace(/\/$/, '') + selectedEndpoint.value

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (authHeader.value) {
      headers['Authorization'] = authHeader.value
    }

    const fetchOptions: RequestInit = {
      method: method.value,
      headers,
    }

    if (showBody.value && requestBody.value.trim()) {
      fetchOptions.body = requestBody.value
    }

    const res = await fetch(url, fetchOptions)
    responseStatus.value = `${res.status} ${res.statusText}`
    responseError.value = !res.ok

    const contentType = res.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const json = await res.json()
      response.value = JSON.stringify(json, null, 2)
    } else {
      response.value = await res.text()
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    responseStatus.value = 'Network Error'
    responseError.value = true
    response.value = `${errorMessage}\n\nIf this is a CORS error, ensure your Next.js app allows cross-origin requests from this origin, or use the "Try in Live App" link above.`
    corsNote.value = true
  } finally {
    loading.value = false
  }
}

function clearResponse() {
  response.value = null
  responseStatus.value = ''
  responseError.value = false
  corsNote.value = false
}
</script>
