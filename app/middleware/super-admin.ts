// 超级管理员路由守卫 — 仅允许 super_admin 角色访问
export default defineNuxtRouteMiddleware(async () => {
  try {
    // 内部 API 调用：服务端直接执行 handler，客户端发 HTTP 请求
    const data: any = await $fetch('/api/auth/me')
    if (!data.success || data.admin?.role !== 'super_admin') {
      return navigateTo('/admin', { redirectCode: 302 })
    }
  } catch {
    return navigateTo('/login', { redirectCode: 302 })
  }
})
