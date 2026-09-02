/**
 * 学生端路由守卫：
 * - 在页面 meta 设了 middleware: 'student' 时触发
 * - 未登录则重定向到 /login
 * - 强制安全设置：使用默认/重置密码，或「未绑邮箱且系统已配置邮件服务」→ 进入 setup-required
 */
export default defineNuxtRouteMiddleware(async (to) => {
  // 只处理学生端页面（双重保险）
  if (!to.path.startsWith('/student')) return

  // SSR 下需把请求的 cookie 透传给内部 $fetch，否则无法识别登录态
  const opts: any = { credentials: 'include' }
  if (process.server) {
    const cookie = useRequestHeaders(['cookie']).cookie
    if (cookie) opts.headers = { cookie }
  }

  try {
    const res = await $fetch<{ success: boolean; student: any }>('/api/auth/student/me', opts)

    if (!res.success || !res.student) {
      return navigateTo('/login')
    }

    // 强制安全设置：使用默认/重置密码，或「未绑邮箱且系统已配置邮件服务」
    // （未配置邮件服务时不以「未绑邮箱」强制，避免无 SMTP 时死锁）
    // mustChangePassword 以布尔形式返回，用真值判断（不能用 === 1）
    const needsSetup =
      !!res.student.mustChangePassword
      || (!res.student.email && res.student.emailServiceConfigured)

    if (needsSetup) {
      if (to.path !== '/student/setup-required') {
        return navigateTo('/student/setup-required')
      }
      return
    }

    // 已完成安全设置却仍停留在 setup-required → 放行到主页
    if (to.path === '/student/setup-required') {
      return navigateTo('/student')
    }
  } catch {
    return navigateTo('/login')
  }
})
