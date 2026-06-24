<script setup lang="ts">
import { type Ref } from 'vue'
import type { ToastItem } from '~/plugins/toast'

const nuxtApp = useNuxtApp()
const toasts = nuxtApp.$toast.toasts as Ref<ToastItem[]>
const dismiss = nuxtApp.$toast.dismiss

const iconMap: Record<string, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
}

const bgMap: Record<string, string> = {
  success: 'border-green-500/30 bg-green-500/10',
  error: 'border-red-500/30 bg-red-500/10',
  info: 'border-indigo-500/30 bg-indigo-500/10',
  warning: 'border-yellow-500/30 bg-yellow-500/10',
}

const textMap: Record<string, string> = {
  success: 'text-green-400',
  error: 'text-red-400',
  info: 'text-indigo-400',
  warning: 'text-yellow-400',
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-xl min-w-[280px] max-w-[420px] animate-slide-up"
          :class="bgMap[t.type || 'info'] || bgMap.info"
        >
          <span class="text-lg font-bold" :class="textMap[t.type || 'info']">
            {{ iconMap[t.type || 'info'] }}
          </span>
          <p class="text-sm text-slate-200 flex-1">{{ t.message }}</p>
          <button
            @click="dismiss(t.id)"
            class="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
          >
            ✕
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active {
  transition: all 0.3s ease;
}
.toast-leave-active {
  transition: all 0.2s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(60px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(60px);
}
</style>
