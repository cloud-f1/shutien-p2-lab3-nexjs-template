<template>
  <div class="module-card">
    <div class="module-card-header">
      <span class="module-card-icon">{{ icon }}</span>
      <div>
        <h3 class="module-card-title">{{ title }}</h3>
        <span class="module-card-id">@saas/{{ id }}</span>
      </div>
    </div>
    <p class="module-card-summary">{{ summary }}</p>
    <div v-if="tags.length" class="module-card-tags">
      <span v-for="tag in tags" :key="tag" class="module-card-tag">{{ tag }}</span>
    </div>
    <div class="module-card-links">
      <a :href="docsPath" class="module-card-link">Docs →</a>
      <a :href="demoPath" class="module-card-link">Live Demo →</a>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    id: string
    title: string
    summary: string
    icon?: string
    tags?: string[]
    docsPath?: string
    demoPath?: string
  }>(),
  {
    icon: '📦',
    tags: () => [],
    docsPath: '#',
    demoPath: '#',
  }
)
</script>
