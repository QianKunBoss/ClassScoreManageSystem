<script setup lang="ts">
import type { School, Grade, Class, User, ScoreLog } from '~/types'
import { formatDate } from '~/utils/format'

definePageMeta({ auth: true })

const route = useRoute()

const { data: authData } = useFetch('/api/auth/me', {
  credentials: 'include', server: false, default: () => ({ success: false, admin: null }),
})
const admin = computed(() => authData.value?.admin || null)

// 超级/学校/年级管理员的班级视图相关
const allGrades = ref<Grade[]>([])  // 可见年级列表
const allClasses = ref<Class[]>([]) // 可见班级列表（全部）
const filterGradeId = ref<number | ''>('')  // 年级筛选
const filterClassId = ref<number | ''>('')  // 班级筛选（从 URL 或下拉选）

// 统计范围：'all' = 全校/全年级, 'grade' = 年级, 'class' = 班级
const statsScope = ref<'all' | 'grade' | 'class'>('class')

// 班级详情数据
const classUsers = ref<User[]>([])
const classLogs = ref<ScoreLog[]>([])
const classInfo = ref<Class | null>(null)
const contentLoading = ref(false)

// 顶层数据（超级管理员用）
const schools = ref<School[]>([])

// 是否显示数据视图（选了年级或班级都显示，或选择了统计范围）
const showDataView = computed(() => {
  if (admin.value?.role === 'school_admin') {
    // 学校管理员：选择"全校"时显示；或者选了年级/班级
    return statsScope.value === 'all' || !!filterGradeId.value || !!filterClassId.value
  }
  if (admin.value?.role === 'grade_admin') {
    // 年级管理员：选择"全年级"时显示；或者选了班级
    return statsScope.value === 'all' || !!filterClassId.value
  }
  return !!filterGradeId.value || !!filterClassId.value
})

// 当前选中班级对象
const selectedClass = computed(() =>
  allClasses.value.find(c => c.id === Number(filterClassId.value)) || null
)

// 当前选中的年级对象
const selectedGrade = computed(() =>
  allGrades.value.find(g => g.id === Number(filterGradeId.value)) || null
)

// 排行榜标题
const rankListTitle = computed(() => {
  if (statsScope.value === 'all') {
    if (admin.value?.role === 'school_admin') return '全校 排行榜'
    if (admin.value?.role === 'grade_admin') {
      const grade = allGrades.value.find(g => g.id === Number(filterGradeId.value))
      return `${grade?.name || '全年级'} 排行榜`
    }
    return '排行榜'
  }
  if (selectedClass.value) {
    const gradeName = (selectedClass.value as any).gradeName || ''
    return `${gradeName ? gradeName + ' - ' : ''}${selectedClass.value.name} 排行榜`
  }
  if (selectedGrade.value) return `${selectedGrade.value.name} 排行榜`
  return '排行榜'
})

// 副标题文案
const headerSubtitle = computed(() => {
  if (statsScope.value === 'all') {
    if (admin.value?.role === 'school_admin') return '当前查看：全校统计'
    if (admin.value?.role === 'grade_admin') {
      const grade = allGrades.value.find(g => g.id === Number(filterGradeId.value))
      return `当前查看：${grade?.name || '全年级'}（按班级汇总）`
    }
  }
  if (selectedClass.value) {
    const gradeName = (selectedClass.value as any).gradeName || ''
    return `当前查看：${gradeName ? gradeName + ' - ' : ''}${selectedClass.value.name}`
  }
  if (selectedGrade.value) return `当前查看：${selectedGrade.value.name}（按班级汇总）`
  return '选择一个范围开始管理'
})

// 按年级筛选后的班级列表
const filteredClasses = computed(() => {
  if (!filterGradeId.value) return allClasses.value
  return allClasses.value.filter(c => (c as any).gradeId === Number(filterGradeId.value))
})

// 是否是上级管理员（可以看班级面板）
const isUpperAdmin = computed(() =>
  admin.value && ['school_admin', 'grade_admin', 'super_admin'].includes(admin.value.role)
)
const isClassAdmin = computed(() => admin.value?.role === 'class_admin')

// ==== 初始化加载 ====
watch(admin, async (a) => {
  if (!a) return

  if (a.role === 'super_admin') {
    const res = await $fetch<{ data: School[] }>('/api/schools').catch(() => ({ data: [] }))
    schools.value = res.data || []
    // 超级管理员暂不自动展开班级选择（太多数据）
    return
  }

  if (a.role === 'school_admin') {
    const [gRes, cRes] = await Promise.all([
      $fetch<{ data: Grade[] }>(`/api/grades?schoolId=${a.schoolId}`).catch(() => ({ data: [] })),
      $fetch<{ data: Class[] }>(`/api/classes?schoolId=${a.schoolId}`).catch(() => ({ data: [] })),
    ])
    allGrades.value = gRes.data || []
    allClasses.value = cRes.data || []
  } else if (a.role === 'grade_admin') {
    const cRes = await $fetch<{ data: Class[] }>(`/api/classes?gradeId=${a.gradeId}`).catch(() => ({ data: [] }))
    allClasses.value = cRes.data || []
  } else if (a.role === 'class_admin') {
    // 班级管理员直接加载本班
    filterClassId.value = a.classId
    await loadData({ classId: a.classId })
  }

  // 读取 URL 中的 classId（从其他页面跳过来）
  const urlClassId = route.query.classId ? Number(route.query.classId) : null
  if (urlClassId && isUpperAdmin.value) {
    filterClassId.value = urlClassId
  }
}, { immediate: true })

// 监听班级/年级选择，加载数据
watch([filterClassId, filterGradeId, statsScope], ([cid, gid, scope]) => {
  if (scope === 'all') {
    // 全校/全年级统计
    loadData({})
  } else if (cid) {
    loadData({ classId: Number(cid) })
  } else if (gid) {
    loadData({ gradeId: Number(gid) })
  } else {
    classUsers.value = []
    classLogs.value = []
    classInfo.value = null
  }
})

// 年级筛选变更时，清空班级选择（如果当前班级不属于该年级）
watch(filterGradeId, (gid) => {
  if (!gid) return
  const currentClass = allClasses.value.find(c => c.id === Number(filterClassId.value))
  if (currentClass && (currentClass as any).gradeId !== Number(gid)) {
    filterClassId.value = ''
  }
})

async function loadData(params: { classId?: number; gradeId?: number } = {}) {
  contentLoading.value = true
  try {
    const fetchParams: Record<string, any> = { limit: 200 }
    if (params.classId) fetchParams.classId = params.classId
    if (params.gradeId) fetchParams.gradeId = params.gradeId

    const [uRes, lRes] = await Promise.all([
      $fetch<{ data: User[] }>('/api/users', { params: fetchParams }),
      $fetch<{ data: ScoreLog[] }>('/api/scores/logs', {
        params: { ...fetchParams, limit: 10 },
      }),
    ])
    classUsers.value = uRes.data || []
    classLogs.value = lRes.data || []
    // 从已加载的班级列表里找 info
    if (params.classId) {
      const found = allClasses.value.find(c => c.id === params.classId)
      if (found) classInfo.value = found
    } else {
      classInfo.value = null
    }
  } catch (err) {
    console.error('加载数据失败', err)
  } finally {
    contentLoading.value = false
  }
}

// 排行榜（按 totalScore 降序，显示全部）
const rankList = computed(() =>
  [...classUsers.value].sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0))
)

// 统计数据
const classStats = computed(() => {
  const scores = classUsers.value.map(u => u.totalScore ?? 0)
  if (!scores.length) return null
  const total = scores.reduce((s, v) => s + v, 0)
  return {
    count: scores.length,
    avg: (total / scores.length).toFixed(1),
    max: Math.max(...scores),
    min: Math.min(...scores),
  }
})

// 最近日志格式化
function scoreChangeColor(change: number) {
  return change > 0 ? 'text-emerald-400' : 'text-rose-400'
}
</script>

<template>
  <div>
    <!-- 顶部标题栏 -->
    <section class="border-b border-slate-800/50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div class="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 class="text-xl font-bold text-slate-100">
              {{ admin?.role === 'super_admin' ? '系统管理后台'
                : admin?.role === 'school_admin' ? '学校管理后台'
                : admin?.role === 'grade_admin' ? '年级管理后台'
                : '班级管理后台' }}
            </h1>
            <p class="text-sm text-slate-500 mt-0.5">
              {{ headerSubtitle }}
            </p>
          </div>

          <!-- 上级管理员的筛选器 -->
          <div v-if="isUpperAdmin" class="flex items-center gap-3 flex-wrap">
            <!-- 统计范围切换（学校/年级管理员） -->
            <div class="flex items-center gap-1 p-0.5 rounded-lg bg-slate-800/30">
              <button
                v-if="admin?.role === 'school_admin'"
                @click="statsScope = 'all'; filterGradeId = ''; filterClassId = ''"
                :class="`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  statsScope === 'all'
                    ? 'bg-indigo-500/20 text-indigo-400'
                    : 'text-slate-500 hover:text-slate-300'
                }`"
              >
                全校
              </button>
              <button
                @click="statsScope = 'grade'; filterClassId = ''"
                :class="`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  statsScope === 'grade'
                    ? 'bg-indigo-500/20 text-indigo-400'
                    : 'text-slate-500 hover:text-slate-300'
                }`"
              >
                {{ admin?.role === 'school_admin' ? '年级' : '全年级' }}
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

            <!-- 年级筛选（学校管理员才有年级列表）  -->
            <select
              v-if="(allGrades.length > 0) && (statsScope === 'grade' || statsScope === 'class')"
              v-model="filterGradeId"
              class="select-filter"
            >
              <option value="">全部年级</option>
              <option v-for="g in allGrades" :key="g.id" :value="g.id">{{ g.name }}</option>
            </select>

            <!-- 班级筛选 -->
            <select
              v-if="statsScope === 'class'"
              v-model="filterClassId"
              class="select-filter"
              :disabled="filteredClasses.length === 0"
            >
              <option value="">{{ filteredClasses.length ? '选择班级' : '暂无班级' }}</option>
              <option v-for="c in filteredClasses" :key="c.id" :value="c.id">{{ c.gradeName ? c.gradeName + ' - ' : '' }}{{ c.name }}</option>
            </select>

            <!-- 清空选择 -->
            <button
              v-if="(statsScope === 'class' && filterClassId) || (statsScope === 'grade' && filterGradeId)"
              class="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1 rounded-md border border-slate-700 hover:border-slate-500"
              @click="filterClassId = ''; filterGradeId = ''; statsScope = 'all'"
            >
              ✕ 清空
            </button>

            <!-- 快速跳转到班级/年级管理 -->
            <div class="flex items-center gap-2">
              <NuxtLink
                v-if="admin?.role === 'grade_admin' || admin?.role === 'school_admin'"
                to="/admin/classes"
                class="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                管理班级 →
              </NuxtLink>
              <NuxtLink
                v-if="admin?.role === 'school_admin'"
                to="/admin/grades"
                class="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                管理年级 →
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      <!-- 超级管理员：学校概览（未选年级/班级时） -->
      <div v-if="admin?.role === 'super_admin' && !showDataView" class="animate-slide-up">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-lg font-bold text-slate-100">学校管理</h2>
          <NuxtLink to="/admin/schools" class="btn btn-primary text-sm">管理学校</NuxtLink>
        </div>
        <div v-if="!schools.length" class="glass-card p-8 text-center text-slate-500">
          暂无学校，<NuxtLink to="/admin/schools" class="text-indigo-400">立即添加</NuxtLink>
        </div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="s in schools" :key="s.id" class="glass-card p-5">
            <h3 class="text-base font-bold text-slate-100 mb-1">{{ s.name }}</h3>
            <p class="text-xs text-slate-500">创建于 {{ formatDate(s.createdAt) }}</p>
          </div>
        </div>
      </div>

      <!-- 上级管理员未选任何内容时的提示界面 -->
      <div
        v-else-if="isUpperAdmin && !showDataView"
        class="animate-slide-up"
      >
        <div class="glass-card p-12 flex flex-col items-center justify-center text-center gap-4">
          <div class="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-3xl">📊</div>
          <div>
            <p class="text-slate-200 font-medium mb-1">请选择统计范围</p>
            <p class="text-sm text-slate-500">
              {{ admin?.role === 'school_admin' ? '点击"全校"、"年级"或"班级"按钮，即可查看对应范围的统计数据。' : '点击"全年级"或"班级"按钮，即可查看对应范围的统计数据。' }}
            </p>
          </div>
        </div>
      </div>

      <!-- 数据视图（选了年级或班级后显示排名/统计） -->
      <div v-else class="animate-slide-up">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- 左侧：排行榜 + 最近记录 -->
          <div class="lg:col-span-2 space-y-6">

            <!-- 统计卡片 -->
            <div v-if="classStats" class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div class="glass-card p-4 text-center">
                <p class="text-2xl font-bold text-slate-100">{{ classStats.count }}</p>
                <p class="text-xs text-slate-500 mt-1">班级人数</p>
              </div>
              <div class="glass-card p-4 text-center">
                <p class="text-2xl font-bold text-indigo-400">{{ classStats.avg }}</p>
                <p class="text-xs text-slate-500 mt-1">平均积分</p>
              </div>
              <div class="glass-card p-4 text-center">
                <p class="text-2xl font-bold text-emerald-400">{{ classStats.max }}</p>
                <p class="text-xs text-slate-500 mt-1">最高积分</p>
              </div>
              <div class="glass-card p-4 text-center">
                <p class="text-2xl font-bold text-rose-400">{{ classStats.min }}</p>
                <p class="text-xs text-slate-500 mt-1">最低积分</p>
              </div>
            </div>

            <!-- 班级排行榜 -->
            <div class="glass-card p-6">
              <div class="flex items-center justify-between mb-4">
                  <h2 class="text-base font-bold text-slate-100">
                    {{ rankListTitle }}
                  </h2>
                <span class="text-xs text-slate-600">全部</span>
              </div>
              <div v-if="contentLoading" class="space-y-2">
                <div v-for="i in 5" :key="i" class="h-12 rounded-lg bg-slate-800/40 animate-pulse"></div>
              </div>
              <div v-else-if="classUsers.length === 0" class="text-center py-10 text-slate-500 text-sm">
                <span class="text-2xl mb-2 block">📭</span>
                暂无学生数据
              </div>
              <div v-else class="space-y-1">
                <div
                  v-for="(u, idx) in rankList"
                  :key="u.id"
                  class="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-800/40 transition-colors"
                >
                  <div :class="`rank-badge ${idx < 3 ? `rank-${idx+1}` : 'rank-other'}`">{{ idx + 1 }}</div>
                  <div class="flex-1 min-w-0">
                    <span class="text-sm text-slate-200 truncate block">{{ u.actualName || u.username }}</span>
                    <span v-if="u.actualName" class="text-xs text-slate-600">{{ u.username }}</span>
                  </div>
                  <span class="text-sm font-bold text-indigo-400 tabular-nums">{{ u.totalScore ?? 0 }} 分</span>
                </div>
                <p class="text-xs text-slate-600 text-center pt-2">
                  共 {{ classUsers.length }} 名同学
                </p>
              </div>
            </div>

            <!-- 最近积分记录 -->
            <div class="glass-card p-6">
              <h2 class="text-base font-bold text-slate-100 mb-4">最近积分记录</h2>
              <div v-if="contentLoading" class="space-y-2">
                <div v-for="i in 3" :key="i" class="h-10 rounded-lg bg-slate-800/40 animate-pulse"></div>
              </div>
              <div v-else-if="classLogs.length === 0" class="text-center py-6 text-slate-500 text-sm">暂无记录</div>
              <div v-else class="space-y-1">
                <div
                  v-for="log in classLogs"
                  :key="log.id"
                  class="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-800/30 transition-colors"
                >
                  <span :class="`text-sm font-bold tabular-nums w-12 text-right shrink-0 ${scoreChangeColor(log.scoreChange)}`">
                    {{ log.scoreChange > 0 ? '+' : '' }}{{ log.scoreChange }}
                  </span>
                  <span class="text-sm text-slate-200 flex-1 truncate">{{ log.username }}</span>
                  <span class="text-xs text-slate-500 shrink-0 hidden sm:block">{{ log.description }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 右侧：快捷操作 -->
          <div>
            <div class="glass-card p-5 sticky top-20">
              <h3 class="text-sm font-bold text-slate-100 mb-4">快捷操作</h3>
              <div class="space-y-2">
                <NuxtLink to="/admin/scores" class="block btn btn-ghost text-sm w-full text-left">📝 积分管理</NuxtLink>
                <NuxtLink to="/admin/users" class="block btn btn-ghost text-sm w-full text-left">👥 用户管理</NuxtLink>
                <NuxtLink to="/admin/templates" class="block btn btn-ghost text-sm w-full text-left">📋 模板管理</NuxtLink>
                <NuxtLink to="/admin/seats" class="block btn btn-ghost text-sm w-full text-left">🪑 座位管理</NuxtLink>
                <NuxtLink to="/admin/stats" class="block btn btn-ghost text-sm w-full text-left">📊 数据统计</NuxtLink>
              </div>

              <!-- 班级/年级基本信息 -->
              <template v-if="selectedClass || selectedGrade || isClassAdmin">
                <hr class="border-slate-800 my-4">
                <h3 class="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">
                  {{ selectedClass ? '班级信息' : '年级信息' }}
                </h3>
                <div class="space-y-2 text-sm">
                  <div v-if="selectedClass" class="flex justify-between">
                    <span class="text-slate-500">班级名称</span>
                    <span class="text-slate-200">{{ selectedClass.name }}</span>
                  </div>
                  <div v-if="selectedGrade" class="flex justify-between">
                    <span class="text-slate-500">年级</span>
                    <span class="text-slate-200">{{ selectedGrade.name }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-500">{{ selectedClass ? '班级人数' : '参与排名人数' }}</span>
                    <span class="text-slate-200">{{ classUsers.length }} 人</span>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>

    </section>
  </div>
</template>

<style scoped>
.select-filter {
  background: rgba(30, 41, 59, 0.8);
  border: 1px solid rgba(71, 85, 105, 0.5);
  border-radius: 8px;
  color: #cbd5e1;
  font-size: 0.875rem;
  padding: 0.375rem 0.75rem;
  outline: none;
  cursor: pointer;
  transition: border-color 0.2s;
  min-width: 120px;
}

.select-filter:focus {
  border-color: rgba(99, 102, 241, 0.6);
}

.select-filter:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.select-filter option {
  background: #1e293b;
  color: #cbd5e1;
}

.rank-badge {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  flex-shrink: 0;
}

.rank-1 { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; }
.rank-2 { background: linear-gradient(135deg, #94a3b8, #64748b); color: white; }
.rank-3 { background: linear-gradient(135deg, #cd7c2f, #b45309); color: white; }
.rank-other { background: rgba(71, 85, 105, 0.3); color: #64748b; }
</style>
