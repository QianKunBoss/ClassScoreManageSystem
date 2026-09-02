// 开发环境下清理浏览器中可能残留的旧版 Service Worker。
// 场景：本机若曾构建/预览过生产版本，浏览器会保留其注册的 SW；
// 即使当前跑 dev（devOptions.enabled=false），该残留 SW 仍可能控制页面，
// 用旧 precache 的 bundle 发起已不存在的接口（如旧版 /api/auth/admin/me），
// 并触发 workbox navigateFallbackAllowlist 告警。
// 此插件在 dev 加载时主动 unregister 所有 SW，避免旧 SW 遮蔽最新 dev 构建。
export default defineNuxtPlugin(() => {
  if (!import.meta.env.DEV) return
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => {
        for (const reg of regs) reg.unregister()
      })
      .catch(() => {})
  })
})
