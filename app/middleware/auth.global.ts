export default defineNuxtRouteMiddleware(async (to) => {
  // 学生端页面，由 student.auth.ts 单独处理，全局中间件直接放行
  if (to.path.startsWith('/student')) return

  // 免检页面：首页、登录页、申请页
  if (to.path === '/' || to.path === '/login' || to.path === '/apply') return

  // SSR 下需把请求的 cookie 透传给内部 $fetch，否则无法识别登录态
  const opts: any = { credentials: 'include' }
  if (process.server) {
    const cookie = useRequestHeaders(['cookie']).cookie
    if (cookie) opts.headers = { cookie }
  }

  try {
    const res = await $fetch<{ success: boolean; admin: any }>('/api/auth/me', opts)

    // 未登录（含 /settings）→ 回登录页
    if (!res.success) {
      if (to.path !== '/login') return navigateTo('/login')
      return
    }

    // 强制安全设置触发条件：
    // 1) 仍使用默认/重置密码（mustChangePassword 为真）——始终强制改密，
    //    与邮箱服务是否启用无关（用户明确要求：无论邮箱是否配置都要改密码）；
    // 2) 未绑定邮箱「且」系统已配置邮件服务——此时才能真正发出验证码完成绑定。
    // 注意：未配置邮件服务时不以「未绑邮箱」强制，避免新装系统无 SMTP 时死锁。
    // 注意：mustChangePassword 由后端以布尔形式返回（true/false），需用真值判断，
    // 不能用 === 1（true === 1 为 false，会导致强制改密失效）。
    if (
      !!res.admin?.mustChangePassword
      || (!res.admin?.email && res.admin?.emailServiceConfigured)
    ) {
      // 仅在尚未处于强制改密页时跳转过去
      if (!(to.path === '/settings' && to.query.force === 'true')) {
        return navigateTo('/settings?force=true')
      }
      // 已在强制改密页，放行以避免重定向死循环
      return
    }
  } catch {
    // 网络/接口异常：未登录视为跳转登录页
    if (to.path !== '/login') {
      return navigateTo('/login')
    }
  }
})
