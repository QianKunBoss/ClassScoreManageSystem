<script setup lang="ts">
// 认证状态
const { data: authData, status } = useFetch('/api/auth/me', {
  credentials: 'include',
  server: false,
  immediate: true,
  default: () => ({ success: false, admin: null }),
})

const isLoggedIn = computed(() => authData.value?.success === true)
const currentUser = computed(() => authData.value?.admin || null)

// 用户下拉菜单
const userMenuOpen = ref(false)
function closeUserMenu() { userMenuOpen.value = false }

// 退出登录
async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
  await navigateTo('/login')
}

const mobileMenuOpen = ref(false)

const navLinks = computed(() => {
  const links = [
    { to: '/', label: '首页' },
  ]
  if (currentUser.value) {
    const role = currentUser.value.role
    links.push({ to: '/admin', label: '管理后台' })
    // 班级管理员
    if (role === 'class_admin') {
      links.push(
        { to: '/admin/scores', label: '积分' },
        { to: '/admin/templates', label: '模板' },
        { to: '/admin/users', label: '用户' },
        { to: '/admin/seats', label: '座位' },
        { to: '/admin/stats', label: '统计' },
      )
    }
    // 学校管理员：管理本校所有内容
    if (role === 'school_admin') {
      links.push(
        { to: '/admin/grades', label: '年级' },
        { to: '/admin/classes', label: '班级' },
        { to: '/admin/users', label: '用户' },
        { to: '/admin/teachers', label: '老师管理' },
        { to: '/admin/scores', label: '积分' },
        { to: '/admin/templates', label: '模板' },
        { to: '/admin/seats', label: '座位' },
        { to: '/admin/stats', label: '统计' },
      )
    }
    // 年级管理员：管理本年级
    if (role === 'grade_admin') {
      links.push(
        { to: '/admin/classes', label: '班级' },
        { to: '/admin/teachers', label: '老师管理' },
        { to: '/admin/users', label: '用户' },
        { to: '/admin/scores', label: '积分' },
        { to: '/admin/templates', label: '模板' },
      )
    }
    if (role === 'super_admin') {
      links.push(
        { to: '/superadmin', label: '系统管理' },
        { to: '/admin/announcements', label: '公告' },
      )
    }
  }
  return links
})
</script>

<template>
  <ClientOnly>
    <nav class="sticky top-0 z-40 border-b border-slate-700/50" style="background: rgba(10, 10, 26, 0.8); backdrop-filter: blur(20px);">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <!-- Logo -->
          <NuxtLink to="/" class="flex items-center gap-2.5 group">
            <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-500/30 group-hover:scale-105 transition-transform">
              C
            </div>
            <span class="text-lg font-bold gradient-text hidden sm:block">CSMS</span>
          </NuxtLink>

          <!-- 桌面端导航 -->
          <div class="hidden md:flex items-center gap-1">
            <template v-if="isLoggedIn">
              <NuxtLink
                v-for="link in navLinks"
                :key="link.to"
                :to="link.to"
                class="px-3.5 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all duration-200"
                active-class="!text-indigo-400 !bg-indigo-500/10"
              >
                {{ link.label }}
              </NuxtLink>
            </template>
          </div>

          <!-- 右侧 -->
          <div class="flex items-center gap-2">
            <!-- 用户信息（桌面端：下拉菜单） -->
            <template v-if="isLoggedIn && currentUser">
              <div class="relative hidden sm:flex items-center pl-3 ml-1 border-l border-slate-700/50">
                <button
                  @click="userMenuOpen = !userMenuOpen"
                  class="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-slate-800/50 transition-all duration-200"
                >
                  <div class="text-right">
                    <p class="text-sm font-semibold text-slate-200">{{ currentUser.username }}</p>
                    <p class="text-xs text-slate-500">管理员</p>
                  </div>
                  <span class="text-xs text-slate-500 transition-transform duration-200" :class="{ 'rotate-180': userMenuOpen }">▼</span>
                </button>

                <!-- 下拉菜单 -->
                <Transition name="fade-scale">
                  <div
                    v-if="userMenuOpen"
                    class="absolute right-0 top-full mt-2 w-44 glass-card p-1.5 z-50"
                  >
                    <NuxtLink
                      to="/settings"
                      @click="userMenuOpen = false"
                      class="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-slate-800/50 transition-all"
                    >
                      ⚙️ 个人设置
                    </NuxtLink>
                    <button
                      @click="logout(); userMenuOpen = false"
                      class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-all text-left"
                    >
                      🚪 退出登录
                    </button>
                  </div>
                </Transition>
              </div>

              <!-- 移动端：设置入口 + 退出 -->
              <div class="flex sm:hidden items-center gap-3">
                <NuxtLink
                  to="/settings"
                  class="text-xs text-slate-400 hover:text-indigo-400 transition-colors"
                >
                  ⚙️
                </NuxtLink>
                <button
                  @click="logout"
                  class="text-xs text-slate-400 hover:text-red-400 transition-colors"
                >
                  🚪
                </button>
              </div>
            </template>

            <NuxtLink
              v-else-if="status !== 'pending'"
              to="/login"
              class="btn btn-primary text-sm"
            >
              登录
            </NuxtLink>

            <!-- 移动端菜单按钮 -->
            <button
              @click="mobileMenuOpen = !mobileMenuOpen"
              class="md:hidden w-9 h-9 rounded-lg bg-slate-800/50 flex items-center justify-center text-base"
            >
              {{ mobileMenuOpen ? '✕' : '☰' }}
            </button>
          </div>
        </div>

        <!-- 移动端菜单 -->
        <Transition name="slide-down">
          <div v-if="mobileMenuOpen" class="md:hidden border-t border-slate-700/50 py-3 space-y-1">
            <template v-if="isLoggedIn">
              <NuxtLink
                v-for="link in navLinks"
                :key="link.to"
                :to="link.to"
                @click="mobileMenuOpen = false"
                class="block px-4 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all"
                active-class="!text-indigo-400 !bg-indigo-500/10"
              >
                {{ link.label }}
              </NuxtLink>
              <div class="pt-2 mt-2 border-t border-slate-700/50">
                <NuxtLink
                  to="/settings"
                  @click="mobileMenuOpen = false"
                  class="block px-4 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/50 transition-all"
                >
                  ⚙️ 个人设置
                </NuxtLink>
                <button
                  @click="logout"
                  class="w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all"
                >
                  退出登录
                </button>
              </div>
            </template>
            <template v-else>
              <NuxtLink
                to="/login"
                @click="mobileMenuOpen = false"
                class="block px-4 py-2.5 rounded-lg text-sm font-medium text-indigo-400 hover:bg-indigo-500/10 transition-all"
              >
                登录
              </NuxtLink>
            </template>
          </div>
        </Transition>
      </div>
    </nav>
  </ClientOnly>
</template>

<style scoped>
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: all 0.15s ease;
}
.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-4px);
}
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.2s ease;
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
