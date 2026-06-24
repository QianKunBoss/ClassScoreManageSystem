/**
 * 学生端路由守卫：
 * - 在页面 meta 设了 middleware: 'student' 时触发
 * - 未登录则重定向到 /login
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
  } catch {
    return navigateTo('/login')
  }
})
