export default defineNuxtRouteMiddleware(async (to) => {
  // 学生端页面，由 student.auth.ts 单独处理，全局中间件直接放行
  if (to.path.startsWith('/student')) return

  // 免检页面：首页、登录页、申请页
  if (to.path === '/' || to.path === '/login' || to.path === '/apply') return

  // 已在设置页，放行（设置页内部处理强制模式）
  if (to.path === '/settings') return

  // 客户端才执行（服务端渲染时 session 可能未就绪）
  if (process.server) return

  try {
    const res = await $fetch<{ success: boolean; admin: any }>('/api/auth/me', {
      credentials: 'include',
    })

    if (res.success && res.admin?.mustChangePassword === 1) {
      return navigateTo('/settings?force=true')
    }
  } catch {
    // 未登录，跳转登录页
    if (to.path !== '/login') {
      return navigateTo('/login')
    }
  }
})
