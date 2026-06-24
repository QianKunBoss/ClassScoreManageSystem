<script setup lang="ts">
import type { User, ScoreLog, PaginatedResponse } from '~/types'
import { formatTime } from '~/utils/format'

definePageMeta({ auth: true })

const { data: authData } = useFetch('/api/auth/me', {
  credentials: 'include',
  server: false,
  default: () => ({ success: false, admin: null }),
})
const currentUser = computed(() => authData.value?.admin || null)

const route = useRoute()
const userId = computed(() => parseInt(route.params.id as string))

const user = ref<User | null>(null)
const userLogs = ref<ScoreLog[]>([])
const loading = ref(true)

watchEffect(async () => {
  if (!currentUser.value || isNaN(userId.value)) return
  try {
    const [usersRes, logsRes] = await Promise.all([
      $fetch<PaginatedResponse<User>>('/api/users'),
      $fetch<PaginatedResponse<ScoreLog>>('/api/scores/logs', { params: { userId: userId.value, limit: 50 } }),
    ])
    user.value = usersRes.data.find(u => u.id === userId.value) || null
    userLogs.value = logsRes.data
  } catch (err) {
    console.error('加载数据失败', err)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <section class="border-b border-slate-800/50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <button @click="navigateTo('/admin/users')" class="text-sm text-slate-500 hover:text-slate-300 transition-colors mb-3">
          ← 返回用户列表
        </button>
        <h1 class="text-xl font-bold text-slate-100">用户详情</h1>
      </div>
    </section>

    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div v-if="loading" class="flex justify-center py-20">
        <div class="w-8 h-8 border-2 border-slate-700 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>

      <div v-else-if="user" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- 用户信息卡 -->
        <div class="lg:col-span-1">
          <div class="glass-card p-6 animate-slide-up">
            <div class="flex flex-col items-center text-center mb-6">
              <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-3xl mb-4 shadow-lg shadow-indigo-500/20">
                {{ user.username.charAt(0).toUpperCase() }}
              </div>
              <h2 class="text-lg font-bold text-slate-100">{{ user.username }}</h2>
              <p class="text-xs text-slate-500 mt-1">ID: {{ user.id }}</p>
            </div>

            <div class="space-y-3">
              <div class="flex items-center justify-between p-3 rounded-lg bg-slate-800/30">
                <span class="text-sm text-slate-500">总积分</span>
                <span class="text-lg font-bold text-indigo-400">{{ user.totalScore }}</span>
              </div>
              <div class="flex items-center justify-between p-3 rounded-lg bg-slate-800/30">
                <span class="text-sm text-slate-500">加分总计</span>
                <span class="text-sm font-bold text-green-400">+{{ user.addScore }}</span>
              </div>
              <div class="flex items-center justify-between p-3 rounded-lg bg-slate-800/30">
                <span class="text-sm text-slate-500">扣分总计</span>
                <span class="text-sm font-bold text-red-400">{{ user.deductScore }}</span>
              </div>
              <div class="flex items-center justify-between p-3 rounded-lg bg-slate-800/30">
                <span class="text-sm text-slate-500">操作次数</span>
                <span class="text-sm font-bold text-slate-300">{{ user.scoreCount }}</span>
              </div>
              <div class="flex items-center justify-between p-3 rounded-lg bg-slate-800/30">
                <span class="text-sm text-slate-500">注册时间</span>
                <span class="text-xs text-slate-400">{{ formatTime(user.createdAt) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 积分记录 -->
        <div class="lg:col-span-2">
          <div class="glass-card p-6 animate-slide-up" style="animation-delay: 0.1s">
            <h2 class="text-sm font-bold text-slate-100 mb-5">积分记录</h2>
            <div v-if="userLogs.length === 0" class="text-center py-12 text-slate-600 text-sm">
              暂无积分记录
            </div>
            <div v-else class="space-y-2 max-h-[600px] overflow-y-auto">
              <div
                v-for="log in userLogs"
                :key="log.id"
                class="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-800/30 transition-all"
              >
                <div
                  :class="`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    log.scoreChange > 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                  }`"
                >
                  {{ log.scoreChange > 0 ? '+' : '−' }}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm text-slate-200 truncate">{{ log.description || '积分调整' }}</p>
                  <p class="text-xs text-slate-600">{{ formatTime(log.createdAt) }}</p>
                </div>
                <span :class="`text-base font-bold ${log.scoreChange > 0 ? 'text-green-400' : 'text-red-400'}`">
                  {{ log.scoreChange > 0 ? '+' : '' }}{{ log.scoreChange }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="text-center py-20">
        <p class="text-slate-500 mb-4">用户不存在</p>
        <NuxtLink to="/admin/users" class="btn btn-primary">返回用户列表</NuxtLink>
      </div>
    </section>
  </div>
</template>
