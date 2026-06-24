<script setup lang="ts">
import type { User, ScoreLog, PaginatedResponse, Grade, Class } from '~/types'
import { formatTime } from '~/utils/format'

definePageMeta({ auth: true })

const { data: authData } = useFetch('/api/auth/me', {
  credentials: 'include',
  server: false,
  default: () => ({ success: false, admin: null }),
})
const currentUser = computed(() => authData.value?.admin || null)

const users = ref<User[]>([])
const logs = ref<ScoreLog[]>([])
const loading = ref(true)
const logSearching = ref(false)

// 筛选相关
const allGrades = ref<Grade[]>([])
const allClasses = ref<Class[]>([])
const filterGradeId = ref<number | ''>('')
const filterClassId = ref<number | ''>('')

// 统计范围：'all' = 全校/全年级, 'grade' = 年级, 'class' = 班级
const statsScope = ref<'all' | 'grade' | 'class'>('all')

// 加载年级/班级列表
watchEffect(async () => {
  if (!currentUser.value) return
  if (currentUser.value.role === 'school_admin') {
    const [gRes, cRes] = await Promise.all([
      $fetch<{ data: Grade[] }>(`/api/grades?schoolId=${currentUser.value.schoolId}`).catch(() => ({ data: [] })),
      $fetch<{ data: Class[] }>(`/api/classes?schoolId=${currentUser.value.schoolId}`).catch(() => ({ data: [] })),
    ])
    allGrades.value = gRes.data || []
    allClasses.value = cRes.data || []
  } else if (currentUser.value.role === 'grade_admin') {
    const cRes = await $fetch<{ data: Class[] }>(`/api/classes?gradeId=${currentUser.value.gradeId}`).catch(() => ({ data: [] }))
    allClasses.value = cRes.data || []
    // 获取年级信息
    const gRes = await $fetch<{ data: Grade[] }>(`/api/grades?schoolId=${currentUser.value.schoolId}`).catch(() => ({ data: [] }))
    allGrades.value = gRes.data || []
  }
})

// 按年级筛选后的班级列表
const filteredClasses = computed(() => {
  if (!filterGradeId.value) return allClasses.value
  return allClasses.value.filter(c => (c as any).gradeId === Number(filterGradeId.value))
})

// 监听筛选变化，重新加载数据
watch([statsScope, filterGradeId, filterClassId], () => {
  loadData()
  loadLogs()
}, { immediate: true })

async function loadData() {
  loading.value = true
  try {
    const params: any = { limit: 200 }
    if (statsScope.value === 'class' && filterClassId.value) {
      params.classId = Number(filterClassId.value)
    } else if (statsScope.value === 'grade' && filterGradeId.value) {
      params.gradeId = Number(filterGradeId.value)
    } else if (statsScope.value === 'all') {
      // 全校/全年级：不传 classId/gradeId，拉全部
      if (currentUser.value?.role === 'grade_admin' && currentUser.value.gradeId) {
        params.gradeId = currentUser.value.gradeId
      }
    }
    const usersRes = await $fetch<PaginatedResponse<User>>('/api/users', { params })
    users.value = usersRes.data
  } catch (err) {
    console.error('加载数据失败', err)
  } finally {
    loading.value = false
  }
}

const logDate = ref<string>(new Date().toISOString().slice(0, 10))

async function loadLogs() {
  logSearching.value = true
  try {
    const params: any = { limit: 100 }
    if (logDate.value) params.date = logDate.value
    if (statsScope.value === 'class' && filterClassId.value) {
      params.classId = Number(filterClassId.value)
    } else if (statsScope.value === 'grade' && filterGradeId.value) {
      params.gradeId = Number(filterGradeId.value)
    }
    const res = await $fetch<PaginatedResponse<ScoreLog>>('/api/scores/logs', { params })
    logs.value = res.data
  } catch (err) {
    console.error('加载日志失败', err)
  } finally {
    logSearching.value = false
  }
}

const stats = computed(() => {
  const totalUsers = users.value.length
  const totalScore = users.value.reduce((s, u) => s + (u.totalScore ?? 0), 0)
  const avgScore = totalUsers > 0 ? Math.round(totalScore / totalUsers) : 0
  const totalLogs = logs.value.length
  const positiveLogs = logs.value.filter(l => l.scoreChange > 0).length
  const negativeLogs = logs.value.filter(l => l.scoreChange < 0).length
  return { totalUsers, totalScore, avgScore, totalLogs, positiveLogs, negativeLogs }
})

const rankedUsers = computed(() => {
  return [...users.value].sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0))
})

const scopeLabel = computed(() => {
  if (statsScope.value === 'class' && filterClassId.value) {
    const cls = allClasses.value.find(c => c.id === Number(filterClassId.value))
    return cls ? `${cls.gradeName || ''} - ${cls.name}` : '班级'
  }
  if (statsScope.value === 'grade' && filterGradeId.value) {
    const grade = allGrades.value.find(g => g.id === Number(filterGradeId.value))
    return grade ? grade.name : '年级'
  }
  return currentUser.value?.role === 'school_admin' ? '全校' : '全年级'
})
</script>

<template>
  <div>
    <section class="border-b border-slate-800/50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 class="text-xl font-bold text-slate-100 mb-1">数据统计</h1>
            <p class="text-sm text-slate-500">查看{{ scopeLabel }}积分统计数据</p>
          </div>
          <!-- 统计范围切换（学校/年级管理员） -->
          <div v-if="currentUser?.role === 'school_admin' || currentUser?.role === 'grade_admin'"
               class="flex items-center gap-1 p-0.5 rounded-lg bg-slate-800/30">
            <button
              @click="statsScope = 'all'; filterGradeId = ''; filterClassId = ''"
              :class="`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                statsScope === 'all'
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`"
            >
              {{ currentUser?.role === 'school_admin' ? '全校' : '全年级' }}
            </button>
            <button
              v-if="currentUser?.role === 'school_admin'"
              @click="statsScope = 'grade'; filterClassId = ''"
              :class="`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                statsScope === 'grade'
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`"
            >
              年级
            </button>
            <button
              @click="statsScope = 'class'"
              :class="`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                statsScope === 'class'
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`"
            >
              班级
            </button>
          </div>
        </div>
        <!-- 年级/班级筛选下拉框 -->
        <div v-if="(currentUser?.role === 'school_admin' || currentUser?.role === 'grade_admin') && statsScope !== 'all'"
             class="flex items-center gap-3 mt-4 flex-wrap">
          <select
            v-if="statsScope === 'grade' || statsScope === 'class'"
            v-model="filterGradeId"
            class="select-filter"
          >
            <option value="">全部年级</option>
            <option v-for="g in allGrades" :key="g.id" :value="g.id">{{ g.name }}</option>
          </select>
          <select
            v-if="statsScope === 'class'"
            v-model="filterClassId"
            class="select-filter"
            :disabled="filteredClasses.length === 0"
          >
            <option value="">选择班级</option>
            <option v-for="c in filteredClasses" :key="c.id" :value="c.id">
              {{ (c as any).gradeName ? (c as any).gradeName + ' - ' : '' }}{{ c.name }}
            </option>
          </select>
        </div>
      </div>
    </section>

    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- 统计卡片 -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div class="glass-card p-5 animate-slide-up">
          <div class="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3 text-lg">👥</div>
          <p class="text-2xl font-bold text-slate-100">{{ loading ? '—' : stats.totalUsers }}</p>
          <p class="text-xs text-slate-500 mt-0.5">总用户数</p>
        </div>
        <div class="glass-card p-5 animate-slide-up" style="animation-delay: 0.05s">
          <div class="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center mb-3 text-lg">⭐</div>
          <p class="text-2xl font-bold text-slate-100">{{ loading ? '—' : stats.totalScore }}</p>
          <p class="text-xs text-slate-500 mt-0.5">总积分</p>
        </div>
        <div class="glass-card p-5 animate-slide-up" style="animation-delay: 0.1s">
          <div class="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center mb-3 text-lg">📊</div>
          <p class="text-2xl font-bold text-slate-100">{{ loading ? '—' : stats.avgScore }}</p>
          <p class="text-xs text-slate-500 mt-0.5">平均积分</p>
        </div>
        <div class="glass-card p-5 animate-slide-up" style="animation-delay: 0.15s">
          <div class="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center mb-3 text-lg">📋</div>
          <p class="text-2xl font-bold text-slate-100">{{ loading ? '—' : stats.totalLogs }}</p>
          <p class="text-xs text-slate-500 mt-0.5">总操作记录</p>
        </div>
      </div>

      <!-- 加分/扣分统计 -->
      <div class="grid grid-cols-2 gap-4 mb-6">
        <div class="glass-card p-5 flex items-center justify-between">
          <div>
            <p class="text-xs text-slate-500 mb-1">加分操作</p>
            <p class="text-xl font-bold text-green-400">{{ stats.positiveLogs }}</p>
          </div>
          <div class="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-xl">↑</div>
        </div>
        <div class="glass-card p-5 flex items-center justify-between">
          <div>
            <p class="text-xs text-slate-500 mb-1">扣分操作</p>
            <p class="text-xl font-bold text-red-400">{{ stats.negativeLogs }}</p>
          </div>
          <div class="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-xl">↓</div>
        </div>
      </div>

      <!-- 详细数据 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- 积分排名 -->
        <div class="glass-card p-6 animate-slide-up">
          <h2 class="text-sm font-bold text-slate-100 mb-5">{{ scopeLabel }}积分排名</h2>
          <div v-if="loading" class="space-y-2">
            <div v-for="i in 6" :key="i" class="flex items-center gap-4 p-2.5 animate-pulse">
              <div class="w-8 h-8 rounded-lg bg-slate-800"></div>
              <div class="flex-1 h-3 w-24 rounded bg-slate-800"></div>
              <div class="w-12 h-3 rounded bg-slate-800"></div>
            </div>
          </div>
          <div v-else class="space-y-1">
            <div
              v-for="(u, idx) in rankedUsers"
              :key="u.id"
              class="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/40 transition-all"
            >
              <div :class="`rank-badge ${idx < 3 ? `rank-${idx + 1}` : 'rank-other'}`">
                {{ idx + 1 }}
              </div>
              <p class="flex-1 text-sm font-medium text-slate-200 truncate">{{ u.username }}</p>
              <span class="text-sm font-bold text-indigo-400">{{ u.totalScore }}</span>
            </div>
          </div>
        </div>

        <!-- 操作记录 -->
        <div class="glass-card p-6 animate-slide-up" style="animation-delay: 0.1s">
          <div class="flex items-center justify-between mb-5 flex-wrap gap-3">
            <h2 class="text-sm font-bold text-slate-100">操作记录</h2>
            <div class="flex items-center gap-2">
              <input
                type="date"
                v-model="logDate"
                class="form-input py-1.5 text-xs w-auto"
                :max="new Date().toISOString().slice(0, 10)"
              />
              <button
                @click="loadLogs"
                :disabled="logSearching"
                class="btn btn-primary text-xs py-1.5 px-3"
              >
                {{ logSearching ? '查询中...' : '查询' }}
              </button>
            </div>
          </div>
          <div v-if="logSearching" class="space-y-2">
            <div v-for="i in 6" :key="i" class="h-12 rounded-lg bg-slate-800/40 animate-pulse"></div>
          </div>
          <div v-else-if="logs.length === 0" class="text-center py-8 text-slate-600 text-sm">
            {{ logDate ? `${logDate} 暂无操作记录` : '暂无操作记录' }}
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
                <p class="text-xs text-slate-600">{{ log.username }} · {{ formatTime(log.createdAt) }}</p>
              </div>
              <span :class="`text-sm font-bold ${log.scoreChange > 0 ? 'text-green-400' : 'text-red-400'}`">
                {{ log.scoreChange > 0 ? '+' : '' }}{{ log.scoreChange }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
