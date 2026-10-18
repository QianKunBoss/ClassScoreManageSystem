// 超级管理员路由守卫 — 仅允许 super_admin 角色访问
export default defineNuxtRouteMiddleware(async () => {
  // SSR 阶段跳过：渲染链路里的内部请求带不上入站 Cookie，
  // 在服务端判断会把已登录用户直接踢回登录页（整页刷新即触发）。
  // 鉴权统一在客户端完成（页面数据本身也都由客户端带会话拉取）。
  if (import.meta.server) return

  try {
    const data: any = await $fetch('/api/auth/me', { credentials: 'include' })
    if (!data.success || data.admin?.role !== 'super_admin') {
      return navigateTo('/admin', { redirectCode: 302 })
    }
  } catch {
    return navigateTo('/login', { redirectCode: 302 })
  }
})
