<script setup lang="ts">
import { useSiteSettings } from '~/composables/useSiteSettings'
import { useRoute } from 'vue-router'
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

// 侧边栏仅在校管/年级管/班管的管理后台页面显示，首页及公开页不显示
const route = useRoute()
const showOrgSidebar = computed(() => route.path.startsWith('/admin'))
</script>

<template>
  <div class="min-h-screen flex flex-col bg-[#0a0a1a]">
    <AppNavbar />
    <AppAnnouncementBar />
    <div class="flex flex-1 flex-col md:flex-row">
      <AdminOrgSidebar v-if="showOrgSidebar" />
      <main class="min-w-0 flex-1">
        <slot />
      </main>
    </div>
    <AppFooter />
    <UiToast />
  </div>
</template>
