// Toast 全局插件 — 通过 provide / inject 提供
import { readonly } from 'vue'

export interface ToastItem {
  id: number
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
  duration: number
}

export default defineNuxtPlugin(() => {
  const toasts = useState<ToastItem[]>('csms-toasts', () => [])
  let idCounter = 0

  function show(message: string, type: ToastItem['type'] = 'info', duration = 3000) {
    const id = ++idCounter
    toasts.value = [...toasts.value, { id, message, type, duration }]
    if (duration > 0) { setTimeout(() => dismiss(id), duration) }
  }

  function success(msg: string) { show(msg, 'success') }
  function error(msg: string) { show(msg, 'error', 4000) }
  function info(msg: string) { show(msg, 'info') }
  function warning(msg: string) { show(msg, 'warning', 4000) }
  function dismiss(id: number) { toasts.value = toasts.value.filter(t => t.id !== id) }

  return {
    provide: {
      toast: { toasts: readonly(toasts), show, success, error, info, warning, dismiss },
    },
  }
})
