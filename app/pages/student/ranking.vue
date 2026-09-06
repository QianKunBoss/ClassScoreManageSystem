<script setup lang="ts">
definePageMeta({ middleware: 'student', layout: 'student' })

import MiniSparkline from '~/components/chart/MiniSparkline.vue'
import MiniCandles from '~/components/chart/MiniCandles.vue'
import ScoreTrendLine from '~/components/chart/ScoreTrendLine.vue'
import ScoreCandlestick from '~/components/chart/ScoreCandlestick.vue'

const toast = useToast()

// 学生信息
const { data: meData } = useFetch('/api/auth/student/me', {
  credentials: 'include',
  server: false,
  immediate: true,
})

const student = computed(() => meData.value?.student || null)

// 同班同学排名
const classmates = ref<any[]>([])
const loading = ref(true)

// ===== 积分趋势迷你图（每行一份：折线 + K 线，与管理员排行榜一致） =====
const TREND_DAYS = 30
const trendUsers = ref<{ days: string[]; users: Record<string, number[][]> }>({
  days: [],
  users: {},
})
const trendLoading = ref(false)

// 迷你图较小，点击行可展开查看该同学的大图
const expandedUserId = ref<number | null>(null)
const expandedTrend = ref<any>(null)
const expandedLoading = ref(false)

// 每个学生 → { candles: OHLC 序列, nets: 每日净变化 }
const trendMap = computed<Record<number, {
  candles: { o: number; c: number; h: number; l: number; n: number }[]
  nets: number[]
}>>(() => {
  const out: Record<number, any> = {}
  for (const [k, arr] of Object.entries(trendUsers.value.users || {})) {
    const candles = (arr as number[][]).map(([o, c, h, l, n]) => ({ o, c, h, l, n }))
    out[Number(k)] = { candles, nets: candles.map(d => d.n) }
  }
  return out
})

// 展开大图：按需拉取该同学明细（含加分/减分/操作次数，用于 tooltip）
async function toggleExpand(u: any) {
  if (expandedUserId.value === u.id) {
    expandedUserId.value = null
    expandedTrend.value = null
    return
  }
  expandedUserId.value = u.id
  expandedTrend.value = null
  expandedLoading.value = true
  try {
    const res = await $fetch<any>('/api/student/trend', {
      params: { days: TREND_DAYS, userId: u.id },
      credentials: 'include',
    })
    expandedTrend.value = res
  } catch (err) {
    console.error('加载趋势明细失败', err)
  } finally {
    expandedLoading.value = false
  }
}

const expandedPoints = computed<any[]>(() => expandedTrend.value?.data?.days || [])

// 用 watch 代替 onMounted，确保 student 数据就绪后再加载
watch(student, async (val) => {
  if (!val) return
  loading.value = true
  trendLoading.value = true
  try {
    const [cRes, tRes] = await Promise.all([
      $fetch<{ success: boolean; data: any[] }>('/api/student/classmates', {
        credentials: 'include',
      }),
      $fetch<{ days: string[]; users: Record<string, number[][]> }>('/api/student/trend/users', {
        params: { days: TREND_DAYS },
        credentials: 'include',
      }),
    ])
    classmates.value = cRes.data || []
    trendUsers.value = { days: tRes?.days || [], users: tRes?.users || {} }
  } catch (err) {
    toast.error('加载排名失败')
    console.error(err)
  } finally {
    loading.value = false
    trendLoading.value = false
  }
}, { immediate: true })
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
    <div v-if="!student" class="text-center py-20 text-slate-500">
      正在加载用户信息...
    </div>

    <template v-else>
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-slate-100 mb-1"><MorphIcon name="bar-chart-3" size="1em" class="inline-block align-middle" /> 班级排名</h1>
        <p class="text-sm text-slate-500">
          {{ [student?.gradeName, student?.className].filter(Boolean).join(' - ') || '按积分从高到低排序' }}
        </p>
      </div>

      <!-- 我的排名卡片 -->
      <div class="glass-card p-5 mb-8 flex items-center gap-4 animate-slide-up">
        <div class="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-400 text-xl font-bold">
          {{ classmates.findIndex((u: any) => u.id === student.id) + 1 || '-' }}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-bold text-slate-100 truncate">{{ student.actualName || student.username }}</p>
          <p class="text-xs text-slate-500">我的当前排名</p>
        </div>
        <div class="text-right">
          <p class="text-lg font-black text-brand-400">{{ student.totalScore ?? 0 }}</p>
          <p class="text-xs text-slate-500">积分</p>
        </div>
      </div>

      <!-- 排名列表（与管理员排行榜一致：名次 / 用户 / 总积分 / 加分 / 减分 / 趋势） -->
      <div class="glass-card overflow-hidden animate-slide-up" style="animation-delay: 0.05s">
        <div v-if="loading" class="p-6 space-y-3">
          <div v-for="i in 8" :key="i" class="h-14 rounded-lg bg-slate-800/40 animate-pulse"></div>
        </div>
        <div v-else-if="classmates.length === 0" class="p-8 text-center text-slate-600 text-sm">
          暂无同学数据
        </div>
        <div v-else>
          <!-- 列头 -->
          <div class="flex items-center gap-3 px-3 pb-1 pt-3 text-xs text-slate-500">
            <div class="w-7 shrink-0 text-center">#</div>
            <div class="flex-1 min-w-0">用户</div>
            <div class="w-20 text-right">总积分</div>
            <div class="w-16 text-right text-emerald-400">加分</div>
            <div class="w-16 text-right text-red-400">减分</div>
            <div class="w-[176px] shrink-0 text-center">最近 {{ TREND_DAYS }} 天趋势</div>
          </div>

          <div class="space-y-1 pb-2">
            <div v-for="(u, idx) in classmates" :key="u.id">
              <div
                @click="toggleExpand(u)"
                :title="`查看「${u.actualName || u.username}」的趋势大图`"
                :class="`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  expandedUserId === u.id ? 'bg-brand-500/10 ring-1 ring-brand-500/25' : 'hover:bg-slate-800/40'
                }`"
              >
                <!-- 名次 -->
                <div :class="`w-7 shrink-0 text-center text-sm tabular-nums ${idx < 3 ? 'font-bold text-brand-400' : 'text-slate-500'}`">
                  {{ idx + 1 }}
                </div>

                <!-- 姓名 -->
                <div class="flex-1 min-w-0">
                  <span class="text-sm text-slate-200 truncate block">
                    {{ u.actualName || u.username }}
                    <span v-if="u.id === student.id" class="text-xs text-brand-400 ml-1">(我)</span>
                  </span>
                  <span v-if="u.actualName" class="text-xs text-slate-600">{{ u.username }}</span>
                </div>

                <!-- 总积分 -->
                <span class="w-20 text-right text-sm font-bold text-brand-400 tabular-nums">{{ u.totalScore ?? 0 }}</span>
                <!-- 加分 -->
                <span class="w-16 text-right text-sm font-bold text-emerald-400 tabular-nums">+{{ u.addScore ?? 0 }}</span>
                <!-- 减分 -->
                <span class="w-16 text-right text-sm font-bold text-red-400 tabular-nums">{{ u.deductScore ?? 0 }}</span>

                <!-- 该生专属迷你图：折线（每日净变化）+ K 线（累计积分 OHLC） -->
                <div class="w-[176px] shrink-0 flex items-center justify-end gap-2">
                  <template v-if="trendMap[u.id]">
                    <MiniSparkline :values="trendMap[u.id].nets" :width="78" :height="26" />
                    <MiniCandles :candles="trendMap[u.id].candles" :width="78" :height="26" />
                  </template>
                  <span v-else class="text-[10px] text-slate-700">—</span>
                </div>
              </div>

              <!-- 展开：该生大图（迷你图太小，点开看细节） -->
              <div v-if="expandedUserId === u.id" class="px-3 pb-3 pt-0.5">
                <div class="rounded-lg border border-slate-800/60 bg-slate-900/30 p-3">
                  <div class="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <span class="text-[11px] text-slate-400">
                      {{ u.actualName || u.username }} · 最近 {{ TREND_DAYS }} 天
                    </span>
                    <button
                      @click.stop="toggleExpand(u)"
                      class="text-[11px] text-brand-400 hover:text-brand-300 transition-colors"
                    >
                      收起
                    </button>
                  </div>
                  <div v-if="expandedLoading" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="h-[150px] rounded-lg bg-slate-800/40 animate-pulse"></div>
                    <div class="h-[150px] rounded-lg bg-slate-800/40 animate-pulse"></div>
                  </div>
                  <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p class="text-[11px] text-slate-500 mb-1">每日净变化（折线）</p>
                      <ClientOnly>
                        <ScoreTrendLine :points="expandedPoints" />
                      </ClientOnly>
                    </div>
                    <div>
                      <p class="text-[11px] text-slate-500 mb-1">累计积分 K 线</p>
                      <ClientOnly>
                        <ScoreCandlestick :points="expandedPoints" />
                      </ClientOnly>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <p class="text-xs text-slate-600 text-center pt-2">
              共 {{ classmates.length }} 名同学
            </p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
