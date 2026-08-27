/**
 * 学生端路由守卫：
 * - 在页面 meta 设了 middleware: 'student' 时触发
 * - 未登录则重定向到 /login
 * - 未绑定邮箱的学生账号仅能访问 /student/bind-email（否则重定向到绑定页）
 */
export default defineNuxtRouteMiddleware(async (to) => {
  // 只处理学生端页面（双重保险）
  if (!to.path.startsWith('/student')) return

  try {
    const res = await $fetch<{ success: boolean; student: any }>('/api/auth/student/me', {
      credentials: 'include',
    })

    if (!res.success || !res.student) {
      return navigateTo('/login')
    }

    // 未绑定邮箱 → 强制进入绑定页（绑定页本身除外）
    if (!res.student.email && to.path !== '/student/bind-email') {
      return navigateTo('/student/bind-email')
    }
  } catch {
    return navigateTo('/login')
  }
})
