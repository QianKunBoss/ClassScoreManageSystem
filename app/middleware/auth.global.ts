export default defineNuxtRouteMiddleware(async (to) => {
  // 学生端页面，由 student.auth.ts 单独处理，全局中间件直接放行
  if (to.path.startsWith('/student')) return

  // 免检页面：首页、登录页、申请页
  if (to.path === '/' || to.path === '/login' || to.path === '/apply') return

  // 客户端才执行（服务端渲染时 session 可能未就绪）
  if (process.server) return

  try {
    const res = await $fetch<{ success: boolean; admin: any }>('/api/auth/me', {
      credentials: 'include',
    })

    // 已登录但需强制改密：仅在尚未处于强制改密页时跳转过去
    if (res.success && res.admin?.mustChangePassword === 1) {
      if (!(to.path === '/settings' && to.query.force === 'true')) {
        return navigateTo('/settings?force=true')
      }
      // 已在强制改密页，放行以避免重定向死循环
      return
    }
  } catch {
    // 未登录（含 /settings），跳转登录页 —— 不再无条件放行设置页
    if (to.path !== '/login') {
      return navigateTo('/login')
    }
  }
})
