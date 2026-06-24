<script setup lang="ts">
import { sanitizeHtml } from '~/utils/sanitizeHtml'

interface Announcement {
  id: number
  title: string
  content: string
  type: 'info' | 'warning' | 'important'
  createdAt: string
}

const props = withDefaults(defineProps<{
  topOffset?: number
  maxHeight?: number
  expireTime?: number
}>(), {
  topOffset: 64,
  maxHeight: 200,
  expireTime: 24 * 60 * 60 * 1000,
})

const announcements = ref<Announcement[]>([])
const loading = ref(true)
const visible = ref(true)

const latestAnnouncement = computed(() => {
  const list = announcements.value
  return list.length > 0 ? list[0] : null
})

const safeContent = computed(() => {
  if (!latestAnnouncement.value) return ''
  return sanitizeHtml(latestAnnouncement.value.content)
})

async function loadAnnouncements() {
  loading.value = true
  try {
    const res = await $fetch<{ success: boolean, data: Announcement[] }>('/api/announcements')
    announcements.value = res.data || []
    checkDismissed()
  } catch {
    announcements.value = []
  } finally {
    loading.value = false
  }
}

function checkDismissed() {
  if (!latestAnnouncement.value) {
    visible.value = false
    return
  }
  const latestId = latestAnnouncement.value.id
  const dismissed = localStorage.getItem(`announcement_dismissed_${latestId}`)
  if (dismissed) {
    const dismissedAt = parseInt(dismissed)
    if (Date.now() - dismissedAt < props.expireTime) {
      visible.value = false
      return
    }
    localStorage.removeItem(`announcement_dismissed_${latestId}`)
  }
  visible.value = true
}

function dismissAnnouncement() {
  if (!latestAnnouncement.value) return
  const latestId = latestAnnouncement.value.id
  localStorage.setItem(`announcement_dismissed_${latestId}`, String(Date.now()))
  visible.value = false
}

function getTypeStyle(type: string) {
  switch (type) {
    case 'warning':
      return {
        bg: 'bg-yellow-500/10',
        border: 'border-yellow-500/30',
        text: 'text-yellow-200',
        icon: '⚠️',
      }
    case 'important':
      return {
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
        text: 'text-red-200',
        icon: '🔴',
      }
    default:
      return {
        bg: 'bg-indigo-500/10',
        border: 'border-indigo-500/30',
        text: 'text-indigo-200',
        icon: '📢',
      }
  }
}

onMounted(loadAnnouncements)
</script>

<template>
  <ClientOnly>
    <Transition name="announcement">
      <div
        v-if="visible && latestAnnouncement && !loading"
        class="announcement-bar sticky z-30 border-b"
        :class="[
          getTypeStyle(latestAnnouncement.type).bg,
          getTypeStyle(latestAnnouncement.type).border,
        ]"
        :style="{ top: `${topOffset}px` }"
      >
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex items-start gap-3 py-2.5">
            <span class="text-base shrink-0 mt-0.5">
              {{ getTypeStyle(latestAnnouncement.type).icon }}
            </span>
            <div
              class="flex-1 text-center text-sm overflow-y-auto announcement-content"
              :class="getTypeStyle(latestAnnouncement.type).text"
              :style="{ maxHeight: `${maxHeight - 20}px` }"
              v-html="safeContent"
            ></div>
            <button
              @click="dismissAnnouncement"
              class="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors mt-0.5"
              aria-label="关闭公告"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </ClientOnly>
</template>

<style scoped>
.announcement-enter-active,
.announcement-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.announcement-enter-from,
.announcement-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
  border-top-width: 0;
  border-bottom-width: 0;
}

.announcement-enter-to,
.announcement-leave-from {
  opacity: 1;
  max-height: 200px;
}

.announcement-content :deep(a) {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
  opacity: 0.9;
}

.announcement-content :deep(a:hover) {
  opacity: 1;
}

.announcement-content :deep(b),
.announcement-content :deep(strong) {
  font-weight: 700;
}

.announcement-content :deep(i),
.announcement-content :deep(em) {
  font-style: italic;
}

.announcement-content :deep(u) {
  text-decoration: underline;
}

.announcement-content :deep(br) {
  content: '';
  display: block;
  margin: 0.125rem 0;
}

.announcement-content :deep(p) {
  margin: 0.25rem 0;
}

.announcement-content :deep(p:first-child) {
  margin-top: 0;
}

.announcement-content :deep(p:last-child) {
  margin-bottom: 0;
}

.announcement-content :deep(ul),
.announcement-content :deep(ol) {
  margin: 0.25rem 0;
  padding-left: 1.25rem;
}

.announcement-content :deep(li) {
  margin: 0.125rem 0;
}

.announcement-content :deep(code) {
  background: rgba(0, 0, 0, 0.15);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.875em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.announcement-content :deep(hr) {
  border: none;
  border-top: 1px solid rgba(100, 116, 139, 0.3);
  margin: 0.5rem 0;
}

.announcement-content :deep(h1),
.announcement-content :deep(h2),
.announcement-content :deep(h3),
.announcement-content :deep(h4),
.announcement-content :deep(h5),
.announcement-content :deep(h6) {
  font-weight: 700;
  margin: 0.25rem 0;
}

.announcement-content :deep(h1) { font-size: 1.125rem; }
.announcement-content :deep(h2) { font-size: 1rem; }
.announcement-content :deep(h3) { font-size: 0.95rem; }
.announcement-content :deep(h4) { font-size: 0.9rem; }
.announcement-content :deep(h5) { font-size: 0.85rem; }
.announcement-content :deep(h6) { font-size: 0.8rem; }

.announcement-content :deep(blockquote) {
  border-left: 3px solid currentColor;
  opacity: 0.5;
  padding-left: 0.75rem;
  margin: 0.25rem 0;
  font-style: italic;
}

.announcement-content::-webkit-scrollbar {
  width: 4px;
}

.announcement-content::-webkit-scrollbar-track {
  background: transparent;
}

.announcement-content::-webkit-scrollbar-thumb {
  background: rgba(100, 116, 139, 0.3);
  border-radius: 2px;
}
</style>