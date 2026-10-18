export default defineNuxtRouteMiddleware(async (to) => {
  // 学生端页面，由 student.auth.ts 单独处理，全局中间件直接放行
  if (to.path.startsWith('/student')) return

  // 免检页面：首页、登录页、申请页
  if (to.path === '/' || to.path === '/login' || to.path === '/apply') return

  // SSR 阶段不做鉴权重定向：
  // 受保护页面的数据全部由客户端携带会话请求（页面内 fetch 均为 server:false），
  // 服务端只渲染骨架；而 SSR 渲染链路里的内部请求无法可靠携带入站 Cookie，
  // 若在此判断并重定向，会出现「整页访问/刷新受保护页面被误踢回登录页」。
  // 因此这里统一交给客户端校验（下方逻辑）。
  if (import.meta.server) return

  try {
    const res = await $fetch<{ success: boolean; admin: any }>('/api/auth/me', { credentials: 'include' })

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
    //
    // 「进入组织」状态下放行：该会话由超管主动发起且可一键退出，
    // 若仍强制跳转改密/绑邮箱，会把用户困在被冒充账号的安全设置页。
    const impersonated = !!res.admin?.impersonated || !!res.impersonator
    if (
      !impersonated
      && (
        !!res.admin?.mustChangePassword
        || (!res.admin?.email && res.admin?.emailServiceConfigured)
      )
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
