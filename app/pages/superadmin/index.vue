<script setup lang="ts">
import type { OrgNode } from '~/types'

definePageMeta({ middleware: 'super-admin', layout: 'superadmin' })

const toast = useToast()

const loading = ref(true)
const schools = ref<{ id: number; name: string; disabled: number; createdAt: string }[]>([])
const admins = ref<{ id: number; username: string; role: string; disabled: number; lastLogin: string | null }[]>([])
const pendingApplications = ref(0)

// ===== 组织结构（系统 → 学校 → 年级 → 班级）=====
interface SchoolHierarchy {
  grades: { id: number; name: string }[]
  classes: { id: number; name: string; gradeId: number }[]
}
const hierarchy = ref<Record<number, SchoolHierarchy>>({})
const orgLoading = ref(true)
const collapsed = ref<Set<string>>(new Set())

async function loadHierarchy(list: typeof schools.value) {
  const rows = await Promise.all(list.map(async (s) => {
    try {
      const [g, c] = await Promise.all([
        $fetch<{ data: { id: number; name: string }[] }>('/api/grades', { params: { schoolId: s.id } }),
        $fetch<{ data: { id: number; name: string; gradeId: number }[] }>('/api/classes', { params: { schoolId: s.id } }),
      ])
      return [s.id, { grades: g.data || [], classes: c.data || [] }] as const
    } catch {
      // 单校分库缺失/异常不影响整体展示
      return [s.id, { grades: [], classes: [] }] as const
    }
  }))
  hierarchy.value = Object.fromEntries(rows) as Record<number, SchoolHierarchy>
  // 默认收起到「年级」层级：班级数量以角标提示，点年级可展开，避免图表过宽
  collapsed.value = collapseAllGradeIds()
  orgLoading.value = false
}

function collapseAllGradeIds(): Set<string> {
  const ids = new Set<string>()
  for (const s of schools.value) {
    for (const g of hierarchy.value[s.id]?.grades || []) ids.add(`grade-${s.id}-${g.id}`)
  }
  return ids
}

function expandAllOrg() {
  collapsed.value = new Set()
}

function collapseAllOrg() {
  collapsed.value = collapseAllGradeIds()
}

function toggleOrg(id: string) {
  const next = new Set(collapsed.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  collapsed.value = next
}

const orgTree = computed<OrgNode>(() => {
  const all = Object.values(hierarchy.value)
  const gradeTotal = all.reduce((n, h) => n + h.grades.length, 0)
  const classTotal = all.reduce((n, h) => n + h.classes.length, 0)

  return {
    id: 'root',
    label: 'ClassFire 系统',
    sub: `${schools.value.length} 所学校 · ${gradeTotal} 个年级 · ${classTotal} 个班级`,
    kind: 'root',
    children: schools.value.map((s) => {
      const h = hierarchy.value[s.id] || { grades: [], classes: [] }
      return {
        id: `school-${s.id}`,
        label: s.name,
        sub: s.disabled === 1 ? '已封禁' : `${h.grades.length} 个年级 · ${h.classes.length} 个班级`,
        kind: 'school' as const,
        disabled: s.disabled === 1,
        children: h.grades.map((g) => {
          const cls = h.classes.filter((c) => c.gradeId === g.id)
          return {
            id: `grade-${s.id}-${g.id}`,
            label: g.name,
            sub: `${cls.length} 个班级`,
            kind: 'grade' as const,
            children: cls.map((c) => ({
              id: `class-${s.id}-${c.id}`,
              label: c.name,
              kind: 'class' as const,
            })),
          }
        }),
      }
    }),
  }
})

onMounted(async () => {
  try {
    const [sRes, aRes, pRes] = await Promise.all([
      $fetch<{ data: typeof schools.value }>('/api/schools', { params: { includeDisabled: '1' } }),
      $fetch<{ data: typeof admins.value }>('/api/admin/manage'),
      $fetch<{ data: unknown[] }>('/api/applications', { query: { status: 'pending' } }),
    ])
    schools.value = sRes.data || []
    admins.value = aRes.data || []
    pendingApplications.value = (pRes.data || []).length
    // 层级数据单独加载，不阻塞上方统计卡片渲染
    void loadHierarchy(schools.value)
  } catch {
    toast.error('加载数据失败')
  } finally {
    loading.value = false
  }
})

const stats = computed(() => [
  { label: '学校总数', value: schools.value.length, icon: 'school', to: '/superadmin/schools', desc: `${schools.value.filter(s => s.disabled === 1).length} 所已封禁` },
  { label: '管理员账号', value: admins.value.length, icon: 'users', to: '/superadmin/admins', desc: `${admins.value.filter(a => a.role === 'super_admin').length} 名超级管理员` },
  { label: '待审核申请', value: pendingApplications.value, icon: 'inbox', to: '/superadmin/applications', desc: pendingApplications.value > 0 ? '有待处理的入驻申请' : '暂无待处理' },
])

// 最近登录的 5 个管理员
const recentLogins = computed(() =>
  [...admins.value]
    .filter(a => a.lastLogin)
    .sort((a, b) => new Date(b.lastLogin!).getTime() - new Date(a.lastLogin!).getTime())
    .slice(0, 5)
)

// 待办事项（有待处理项时高亮计数）
const disabledSchools = computed(() => schools.value.filter(s => s.disabled === 1).length)
const todos = computed(() => [
  { icon: 'inbox', label: '待审核入驻申请', desc: pendingApplications.value > 0 ? '点击前往审核' : '暂无待处理', count: pendingApplications.value, to: '/superadmin/applications' },
  { icon: 'ban', label: '已封禁学校', desc: '点击查看并处理', count: disabledSchools.value, to: '/superadmin/schools' },
])

const roleNames: Record<string, string> = {
  super_admin: '超级管理员',
  school_admin: '学校管理员',
  grade_admin: '年级管理员',
  class_admin: '班级管理员',
}
</script>

<template>
  <div>
    <section class="border-b border-slate-800/50">
      <div class="px-4 sm:px-6 lg:px-8 py-6">
        <h1 class="text-xl font-bold text-slate-100 mb-1">概览</h1>
        <p class="text-sm text-slate-500">系统全局配置、管理员账号管理</p>
      </div>
    </section>

    <section class="px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <!-- 统计卡片 -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <NuxtLink
          v-for="s in stats"
          :key="s.label"
          :to="s.to"
          class="glass-card p-5 transition-all hover:border-brand-500/40 hover:-translate-y-0.5"
        >
          <div class="flex items-center justify-between mb-3">
            <span class="text-2xl"><MorphIcon :name="s.icon" size="1em" class="inline-block align-middle" /></span>
            <span class="text-xs text-brand-400">查看 <MorphIcon name="arrow-right" :size="12" class="inline-block align-middle" /></span>
          </div>
          <p class="text-3xl font-bold text-slate-100 tabular-nums">
            <span v-if="loading" class="inline-block w-12 h-8 rounded bg-slate-800/60 animate-pulse align-middle"></span>
            <template v-else>{{ s.value }}</template>
          </p>
          <p class="text-sm text-slate-400 mt-1">{{ s.label }}</p>
          <p class="text-xs text-slate-500 mt-0.5">{{ s.desc }}</p>
        </NuxtLink>
      </div>

      <!-- 组织结构 -->
      <div class="glass-card p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-bold text-slate-100">组织结构</h2>
          <div class="flex items-center gap-3 text-xs">
            <span class="text-slate-500">{{ schools.length }} 所学校</span>
            <button type="button" class="text-brand-400 hover:text-brand-300 transition-colors" @click="expandAllOrg">全部展开</button>
            <span class="text-slate-700">/</span>
            <button type="button" class="text-brand-400 hover:text-brand-300 transition-colors" @click="collapseAllOrg">全部收起</button>
          </div>
        </div>
        <div v-if="orgLoading" class="space-y-3">
          <div class="h-10 w-40 mx-auto rounded-lg bg-slate-800/40 animate-pulse"></div>
          <div class="flex justify-center gap-3">
            <div v-for="i in 4" :key="i" class="h-10 w-28 rounded-lg bg-slate-800/30 animate-pulse"></div>
          </div>
        </div>
        <div v-else class="overflow-x-auto pb-3">
          <div class="w-max mx-auto px-2 pt-1">
            <OrgChart :node="orgTree" :collapsed="collapsed" @toggle="toggleOrg" />
          </div>
        </div>
      </div>

      <!-- 最近登录 + 待办 -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="glass-card p-6 lg:col-span-2">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-bold text-slate-100">最近活跃管理员</h2>
            <NuxtLink to="/superadmin/admins" class="text-xs text-brand-400 hover:text-brand-300 inline-flex items-center gap-0.5">全部管理员 <MorphIcon name="arrow-right" :size="12" class="inline-block align-middle" /></NuxtLink>
          </div>
          <div v-if="loading" class="space-y-2">
            <div v-for="i in 3" :key="i" class="h-10 rounded-lg bg-slate-800/40 animate-pulse"></div>
          </div>
          <div v-else-if="recentLogins.length === 0" class="text-center py-6 text-sm text-slate-500">暂无登录记录</div>
          <div v-else class="space-y-1">
            <div
              v-for="a in recentLogins"
              :key="a.id"
              class="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-800/40 transition-colors"
            >
              <div class="w-8 h-8 rounded-full bg-brand-500/10 flex items-center justify-center text-xs text-brand-400 font-bold shrink-0">
                {{ a.username.slice(0, 1).toUpperCase() }}
              </div>
              <span class="text-sm text-slate-200 flex-1">{{ a.username }}</span>
              <span class="text-xs text-slate-500">{{ roleNames[a.role] || a.role }}</span>
              <span class="text-xs text-slate-500 shrink-0">{{ a.lastLogin ? new Date(a.lastLogin).toLocaleString('zh-CN') : '从未' }}</span>
            </div>
          </div>
        </div>

        <!-- 待办事项 -->
        <div class="glass-card p-6">
          <h2 class="text-sm font-bold text-slate-100 mb-4">待办事项</h2>
          <NuxtLink
            v-for="t in todos"
            :key="t.label"
            :to="t.to"
            class="flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-slate-800/40"
            :class="t.count > 0 ? 'mb-1' : ''"
          >
            <span
              class="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0"
              :class="t.count > 0 ? 'bg-yellow-500/15' : 'bg-slate-800/50'"
            ><MorphIcon :name="t.icon" size="1em" class="inline-block align-middle" /></span>
            <span class="flex-1 min-w-0">
              <span class="block text-sm" :class="t.count > 0 ? 'text-slate-200' : 'text-slate-500'">{{ t.label }}</span>
              <span class="block text-xs text-slate-500 mt-0.5">{{ t.desc }}</span>
            </span>
            <span
              v-if="t.count > 0"
              class="px-2 py-0.5 rounded-full text-xs font-bold tabular-nums bg-yellow-500/15 text-yellow-400"
            >{{ t.count }}</span>
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>
