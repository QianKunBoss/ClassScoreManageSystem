// 全局 Toast — 从插件注入获取
// 此文件放在 app/composables/ 下，Nuxt 4 会自动 auto-import
import { type Ref } from 'vue'
import type { ToastItem } from '~/plugins/toast'

export function useToast() {
  const { $toast } = useNuxtApp()
  return {
    toasts: $toast.toasts as Ref<ToastItem[]>,
    success: (msg: string) => $toast.success(msg),
    error: (msg: string) => $toast.error(msg),
    info: (msg: string) => $toast.info(msg),
    warning: (msg: string) => $toast.warning(msg),
    dismiss: (id: number) => $toast.dismiss(id),
  }
}
