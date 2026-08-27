<script setup lang="ts">
import { useSiteSettings } from '~/composables/useSiteSettings'
import { watch } from 'vue'

// 系统标题 → 浏览器标签/页面标题
const { data: siteSettings } = useSiteSettings()
watch(
  () => siteSettings.value?.data?.system_title,
  (t) => {
    if (import.meta.client) document.title = t || 'CSMS'
  },
  { immediate: true },
)
</script>

<template>
  <div class="min-h-screen flex flex-col bg-[#0a0a1a]">
    <AppNavbar />
    <AppAnnouncementBar />
    <main class="flex-1">
      <slot />
    </main>
    <AppFooter />
    <UiToast />
  </div>
</template>
