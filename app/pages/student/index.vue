<script setup lang="ts">
definePageMeta({ middleware: 'student', layout: 'student' })

import ScoreTrendLine from '~/components/chart/ScoreTrendLine.vue'
import ScoreCandlestick from '~/components/chart/ScoreCandlestick.vue'

const toast = useToast()
const route = useRoute()

// 学生信息
const { data: meData, refresh: refreshMe } = useFetch('/api/auth/student/me', {
  credentials: 'include',
  server: false,
  immediate: true,
})

const student = computed(() => meData.value?.student || null)

// 最近积分记录
const logs = ref<any[]>([])
const logsLoading = ref(true)

// 最近 30 天积分趋势（折线 + K 线）
const trend = ref<any[]>([])
const trendLoading = ref(true)

// 班级同学（用于排名）
const classmates = ref<any[]>([])
const classRank = computed(() => {
  if (!student.value) return null
  const idx = classmates.value.findIndex(u => u.id === student.value!.id)
  return idx >= 0 ? idx + 1 : null
})

// 用 watch 代替 onMounted，确保 student 数据就绪后再加载
watch(student, async (val) => {
  if (!val) return
  logsLoading.value = true
  trendLoading.value = true
  try {
    const [logsRes, classmatesRes] = await Promise.all([
      $fetch('/api/student/logs', {
        params: { userId: val.id, limit: 20 },
        credentials: 'include',
      }),
      $fetch('/api/student/classmates', {
        credentials: 'include',
      }),
    ])
    logs.value = logsRes.data || []
    classmates.value = classmatesRes.data || []

    // 趋势数据（学生端专用，仅本人）
    const trendRes = await $fetch<{ success: boolean; data?: { days: any[] } }>('/api/student/trend', {
      params: { days: 30 },
      credentials: 'include',
    })
    trend.value = trendRes.data?.days || []
  } catch (err) {
    console.error('加载数据失败', err)
  } finally {
    logsLoading.value = false
    trendLoading.value = false
  }
}, { immediate: true })

function formatTime(t: string) {
  return t?.slice(5, 16) || ''
}
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
    <div v-if="!student" class="text-center py-20 text-slate-500">
      正在加载用户信息...
    </div>

    <template v-else>
      <!-- 欢迎语 -->
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-slate-100 mb-1">
          你好，{{ student.actualName || student.username }} <MorphIcon name="hand" size="1em" class="inline-block align-middle" />
        </h1>
        <p class="text-sm text-slate-500">
          所属班级：{{ [student.gradeName, student.className].filter(Boolean).join(' - ') || '未分配' }}
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <!-- 当前积分 -->
        <div class="glass-card p-6 animate-slide-up">
          <p class="text-xs text-slate-500 mb-1">当前积分</p>
          <p class="text-3xl font-black text-brand-400">{{ student.totalScore ?? 0 }}</p>
        </div>

        <!-- 班级排名 -->
        <div class="glass-card p-6 animate-slide-up" style="animation-delay: 0.05s">
          <p class="text-xs text-slate-500 mb-1">班级排名</p>
          <p class="text-3xl font-black" :class="classRank ? 'text-amber-400' : 'text-slate-600'">
            {{ classRank ? `第 ${classRank} 名` : '-' }}
          </p>
        </div>

        <!-- 班级总人数 -->
        <div class="glass-card p-6 animate-slide-up" style="animation-delay: 0.1s">
          <p class="text-xs text-slate-500 mb-1">班级总人数</p>
          <p class="text-3xl font-black text-slate-300">{{ classmates.length }}</p>
        </div>
      </div>

      <!-- 最近 30 天积分趋势（折线图 + K 线图） -->
      <div class="glass-card p-6 animate-slide-up mb-10" style="animation-delay: 0.12s">
        <div class="flex items-center justify-between mb-5">
          <h2 class="text-sm font-bold text-slate-100">最近 30 天积分趋势</h2>
          <span class="text-xs text-slate-600">折线：每日净变化 · K 线：累计积分（红涨绿跌）</span>
        </div>
        <div v-if="trendLoading" class="h-[200px] rounded-lg bg-slate-800/40 animate-pulse"></div>
        <div v-else-if="trend.length === 0" class="text-center py-10 text-slate-600 text-sm">
          暂无趋势数据
        </div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p class="text-xs text-slate-500 mb-2">每日净变化（折线图）</p>
            <ClientOnly>
              <ScoreTrendLine :points="trend" />
            </ClientOnly>
          </div>
          <div>
            <p class="text-xs text-slate-500 mb-2">累计积分（K 线图）</p>
            <ClientOnly>
              <ScoreCandlestick :points="trend" />
            </ClientOnly>
          </div>
        </div>
      </div>

      <!-- 最近积分记录 -->
      <div class="glass-card p-6 animate-slide-up" style="animation-delay: 0.15s">
        <h2 class="text-sm font-bold text-slate-100 mb-5">最近积分记录</h2>
        <div v-if="logsLoading" class="space-y-2">
          <div v-for="i in 5" :key="i" class="h-12 rounded-lg bg-slate-800/40 animate-pulse"></div>
        </div>
        <div v-else-if="logs.length === 0" class="text-center py-8 text-slate-600 text-sm">
          暂无积分记录
        </div>
        <div v-else class="space-y-1.5 max-h-[400px] overflow-y-auto">
          <div
            v-for="log in logs"
            :key="log.id"
            class="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/30 transition-all"
          >
            <div
              :class="`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                log.scoreChange > 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
              }`"
            >
              {{ log.scoreChange > 0 ? '+' : '−' }}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs text-slate-300 truncate">{{ log.description || '积分调整' }}</p>
              <p class="text-xs text-slate-600">{{ formatTime(log.createdAt) }}</p>
            </div>
            <span :class="`text-sm font-bold ${log.scoreChange > 0 ? 'text-green-400' : 'text-red-400'}`">
              {{ log.scoreChange > 0 ? '+' : '' }}{{ log.scoreChange }}
            </span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
