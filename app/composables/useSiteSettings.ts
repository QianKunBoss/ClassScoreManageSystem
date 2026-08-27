// 共享：拉取公开展示设置（导航栏标题 nav_title、系统标题 system_title、开关等）
// 多组件复用同一 key，Nuxt 只会发起一次请求
export function useSiteSettings() {
  return useFetch<{ success: boolean; data: Record<string, string> }>(
    '/api/settings/public',
    {
      key: 'public-settings',
      server: false,
      default: () => ({ success: true, data: {} }),
    },
  )
}
