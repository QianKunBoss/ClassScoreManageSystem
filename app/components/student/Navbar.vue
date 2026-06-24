<script setup lang="ts">
const { data: meData } = useFetch('/api/auth/student/me', {
  credentials: 'include',
  server: false,
  immediate: true,
})

const student = computed(() => meData.value?.student || null)

// 所有功能默认开启（写死，不再从数据库读取）
const showRanking = true

async function handleLogout() {
  try {
    await $fetch('/api/auth/student/logout', {
      method: 'POST',
      credentials: 'include',
    })
    await navigateTo('/login')
  } catch (err) {
    console.error('退出失败', err)
  }
}
</script>

<template>
  <nav class="h-14 border-b border-slate-800/50 bg-slate-900/80 backdrop-blur-xl flex items-center px-4 sm:px-6 sticky top-0 z-40">
    <div class="max-w-6xl mx-auto w-full flex items-center justify-between">
      <!-- 左侧 Logo + 导航 -->
      <div class="flex items-center gap-6">
        <NuxtLink to="/student" class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
            C
          </div>
          <span class="text-sm font-bold text-slate-100 hidden sm:inline">CSMS 学生端</span>
        </NuxtLink>

        <div class="flex items-center gap-1">
          <NuxtLink
            to="/student"
            class="text-xs px-3 py-1.5 rounded-lg transition-all duration-200"
            :class="$route.path === '/student' ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'"
          >
            🏠 我的积分
          </NuxtLink>
          <NuxtLink
            v-if="showRanking"
            to="/student/ranking"
            class="text-xs px-3 py-1.5 rounded-lg transition-all duration-200"
            :class="$route.path.includes('/student/ranking') ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'"
          >
            📊 班级排名
          </NuxtLink>
          <NuxtLink
            to="/student/settings"
            class="text-xs px-3 py-1.5 rounded-lg transition-all duration-200"
            :class="$route.path.includes('/student/settings') ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'"
          >
            ⚙️ 个人设置
          </NuxtLink>
        </div>
      </div>

      <!-- 右侧用户信息 + 退出 -->
      <div class="flex items-center gap-3">
        <span class="text-xs text-slate-500 truncate max-w-[120px]">
          {{ student?.actualName || student?.username || '...' }}
        </span>
        <button
          @click="handleLogout"
          class="text-xs px-3 py-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/5 transition-all duration-200"
        >
          退出
        </button>
      </div>
    </div>
  </nav>
</template>
