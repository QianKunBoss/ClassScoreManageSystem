// useAuth composable - 封装认证逻辑
export function useAuth() {
  // 从 API 获取登录状态
  const { data: authData, refresh: refreshAuth } = useFetch('/api/auth/me', {
    key: 'auth-me',
    default: () => ({ success: false, data: null }),
  })

  // 是否已登录
  const loggedIn = computed(() => authData.value?.success === true)

  // 当前用户
  const user = computed(() => authData.value?.data || null)

  // 退出登录
  async function clear() {
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
      // 刷新 auth 状态
      await refreshAuth()
    } catch (err) {
      console.error('退出登录失败', err)
    }
  }

  return {
    loggedIn,
    user,
    clear,
    refresh: refreshAuth,
  }
}
