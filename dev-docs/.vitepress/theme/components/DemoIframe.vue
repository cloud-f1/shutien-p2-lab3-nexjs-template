<template>
  <div class="demo-iframe-wrapper">
    <!-- Browser chrome toolbar -->
    <div class="demo-iframe-toolbar">
      <div class="demo-iframe-dots">
        <span class="demo-iframe-dot dot-red" />
        <span class="demo-iframe-dot dot-yellow" />
        <span class="demo-iframe-dot dot-green" />
      </div>
      <span class="demo-iframe-url">{{ resolvedUrl }}</span>
      <a
        :href="resolvedUrl"
        target="_blank"
        rel="noopener"
        style="font-size: 0.75rem; color: var(--vp-c-brand-1); font-weight: 600; white-space: nowrap;"
      >
        Open ↗
      </a>
    </div>

    <!-- iframe or placeholder -->
    <div v-if="canEmbed">
      <iframe
        :src="resolvedUrl"
        :height="height"
        class="demo-iframe-frame"
        :title="`Live demo: ${title}`"
        sandbox="allow-scripts allow-same-origin allow-forms"
        loading="lazy"
      />
    </div>
    <div v-else class="demo-iframe-placeholder" :style="{ height: `${height}px` }">
      <div style="font-size: 2.5rem;">🖥️</div>
      <div>
        <strong>{{ title }}</strong>
        <p style="margin: 0.5rem 0 0; font-size: 0.875rem;">
          Configure your deployed Next.js app URL via the
          <code>VITEPRESS_DEMO_BASE</code> environment variable, then rebuild to
          enable live iframe embeds.
        </p>
      </div>
      <a :href="fallbackUrl" target="_blank" rel="noopener">
        View demo at {{ fallbackUrl }}
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    path: string
    title?: string
    height?: number
  }>(),
  {
    title: 'Live Demo',
    height: 500,
  }
)

// The base URL is injected at build time via vitepress define or a runtime
// env shim. Falls back to empty string (shows placeholder).
const demoBase = computed<string>(() => {
  if (typeof window !== 'undefined') {
    const w = window as Window & { VITEPRESS_DEMO_BASE?: string }
    return (w.VITEPRESS_DEMO_BASE ?? '').replace(/\/$/, '')
  }
  return ''
})

const resolvedUrl = computed(() =>
  demoBase.value ? `${demoBase.value}${props.path}` : fallbackUrl.value
)

const fallbackUrl = computed(
  () => `https://your-app.zeabur.app${props.path}`
)

const canEmbed = computed(() => Boolean(demoBase.value))
</script>
