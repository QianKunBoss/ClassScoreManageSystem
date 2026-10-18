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
  await nextTick()
  centerStage()
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

// ===== 画布平移 / 缩放 =====
const canvasEl = ref<HTMLElement | null>(null)
const stageEl = ref<HTMLElement | null>(null)
const zoom = ref(1)
const pan = ref({ x: 0, y: 0 })
const MIN_ZOOM = 0.5
const MAX_ZOOM = 2
const zoomPercent = computed(() => Math.round(zoom.value * 100))

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/** 内容比容器窄时居中，否则从左上角开始 */
function centerStage() {
  const c = canvasEl.value
  const s = stageEl.value
  if (!c || !s) return
  const rect = c.getBoundingClientRect()
  pan.value = { x: Math.max(0, (rect.width - s.offsetWidth * zoom.value) / 2), y: 0 }
}

function resetView() {
  zoom.value = 1
  nextTick(centerStage)
}

/** 以容器中心为锚点缩放 */
function setZoom(next: number) {
  const z = clamp(next, MIN_ZOOM, MAX_ZOOM)
  if (z === zoom.value) return
  const c = canvasEl.value
  if (!c) { zoom.value = z; return }
  const rect = c.getBoundingClientRect()
  const cx = rect.width / 2
  const cy = rect.height / 2
  const sx = (cx - pan.value.x) / zoom.value
  const sy = (cy - pan.value.y) / zoom.value
  pan.value = { x: cx - sx * z, y: cy - sy * z }
  zoom.value = z
}

function zoomBy(factor: number) {
  setZoom(zoom.value * factor)
}

/** 以光标为锚点滚轮缩放 */
function onWheel(e: WheelEvent) {
  const c = canvasEl.value
  if (!c) return
  const rect = c.getBoundingClientRect()
  const cx = e.clientX - rect.left
  const cy = e.clientY - rect.top
  const z = clamp(zoom.value * Math.exp(-e.deltaY * 0.0015), MIN_ZOOM, MAX_ZOOM)
  if (z === zoom.value) return
  const sx = (cx - pan.value.x) / zoom.value
  const sy = (cy - pan.value.y) / zoom.value
  pan.value = { x: cx - sx * z, y: cy - sy * z }
  zoom.value = z
}

interface DragState { active: boolean; moved: boolean; sx: number; sy: number; px: number; py: number }
let dragState: DragState = { active: false, moved: false, sx: 0, sy: 0, px: 0, py: 0 }

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  dragState = { active: true, moved: false, sx: e.clientX, sy: e.clientY, px: pan.value.x, py: pan.value.y }
  canvasEl.value?.setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!dragState.active) return
  const dx = e.clientX - dragState.sx
  const dy = e.clientY - dragState.sy
  if (!dragState.moved && Math.abs(dx) + Math.abs(dy) > 4) dragState.moved = true
  if (dragState.moved) pan.value = { x: dragState.px + dx, y: dragState.py + dy }
}

function onPointerUp() {
  dragState.active = false
  // moved 保留到 click 阶段，用于抑制「拖拽结束时误触节点」
  setTimeout(() => { dragState.moved = false }, 0)
}

/** 捕获阶段拦截：发生过拖拽就不让它变成节点点击 */
function onClickCapture(e: MouseEvent) {
  if (!dragState.moved) return
  e.stopPropagation()
  e.preventDefault()
  dragState.moved = false
}

function onResize() {
  if (zoom.value === 1 && pan.value.y === 0) centerStage()
}

// ===== 组织节点右键菜单（学校 / 年级 / 班级）=====
interface OrgMenuState { node: OrgNode; x: number; y: number }
const orgMenu = ref<OrgMenuState | null>(null)
const menuNode = computed(() => orgMenu.value?.node || null)
const menuSchool = computed(() => {
  const schoolId = menuNode.value?.meta?.schoolId
  if (schoolId == null) return null
  return schools.value.find((s) => s.id === schoolId) || null
})
const menuKindLabel = computed(() =>
  ({ school: '学校', grade: '年级', class: '班级' } as Record<string, string>)[menuNode.value?.kind || ''] || '',
)

function openNodeMenu(payload: { node: OrgNode; event: MouseEvent }) {
  if (!payload.node.meta) return
  // 估算菜单尺寸，避免溢出视口
  const MENU_W = 184
  const MENU_H = 236
  const x = Math.min(payload.event.clientX, window.innerWidth - MENU_W - 8)
  const y = Math.min(payload.event.clientY, window.innerHeight - MENU_H - 8)
  orgMenu.value = { node: payload.node, x: Math.max(8, x), y: Math.max(8, y) }
}

function closeOrgMenu() {
  orgMenu.value = null
}

function onMenuOutside(e: PointerEvent) {
  const el = document.getElementById('org-node-menu')
  if (el && e.target instanceof Node && el.contains(e.target)) return
  closeOrgMenu()
}

function onMenuEsc(e: KeyboardEvent) {
  if (e.key === 'Escape') closeOrgMenu()
}

watch(orgMenu, (open) => {
  if (typeof window === 'undefined') return
  if (open) {
    window.addEventListener('pointerdown', onMenuOutside, true)
    window.addEventListener('keydown', onMenuEsc)
    window.addEventListener('scroll', closeOrgMenu, true)
  } else {
    window.removeEventListener('pointerdown', onMenuOutside, true)
    window.removeEventListener('keydown', onMenuEsc)
    window.removeEventListener('scroll', closeOrgMenu, true)
  }
})

// --- 菜单动作 ---
const confirmToggleSchool = ref<any>(null)
const confirmEnterOrg = ref<any>(null)
const deletingSchool = ref<{ id: number; name: string } | null>(null)
const deletingOrg = ref<{
  kind: 'grade' | 'class'
  name: string
  schoolId: number
  gradeId: number
  classId?: number
  classCount?: number
} | null>(null)
const entering = ref(false)

function menuToggleDisable() {
  const s = menuSchool.value
  if (!s) return
  confirmToggleSchool.value = { ...s }
  closeOrgMenu()
}

function menuDelete() {
  const n = menuNode.value
  if (!n?.meta) return
  if (n.kind === 'school') {
    deletingSchool.value = { id: n.meta.schoolId, name: n.label }
  } else if (n.kind === 'grade' || n.kind === 'class') {
    deletingOrg.value = {
      kind: n.kind,
      name: n.label,
      schoolId: n.meta.schoolId,
      gradeId: n.meta.gradeId!,
      classId: n.meta.classId,
      classCount: n.meta.classCount,
    }
  }
  closeOrgMenu()
}

function menuManage() {
  const s = menuSchool.value
  if (!s) return
  closeOrgMenu()
  navigateTo(`/superadmin/schools/${s.id}`)
}

function menuEnter() {
  const n = menuNode.value
  const s = menuSchool.value
  if (!n || !s) return
  if (s.disabled === 1) {
    toast.error('该校已被封禁，无法进入组织')
    closeOrgMenu()
    return
  }
  confirmEnterOrg.value = {
    nodeKind: n.kind,
    nodeName: n.label,
    schoolId: s.id,
    schoolName: s.name,
    gradeId: n.meta?.gradeId,
    classId: n.meta?.classId,
  }
  closeOrgMenu()
}

/** 组织数据变更后刷新学校列表与组织树 */
async function reloadOrgData() {
  try {
    const res = await $fetch<{ data: typeof schools.value }>('/api/schools', { params: { includeDisabled: '1' } })
    schools.value = res.data || []
    hierarchy.value = {}
    orgLoading.value = true
    await loadHierarchy(schools.value)
  } catch {
    toast.error('刷新组织数据失败')
  }
}

async function confirmToggleSchoolDisabled() {
  const s = confirmToggleSchool.value
  if (!s) return
  const next = s.disabled === 1 ? 0 : 1
  try {
    await $fetch(`/api/schools/${s.id}`, { method: 'PATCH', body: { disabled: next } })
    toast.success(`学校已${next === 1 ? '封禁' : '启用'}`)
    confirmToggleSchool.value = null
    await reloadOrgData()
  } catch (err: any) {
    toast.error(err?.data?.message || err?.data?.statusMessage || '操作失败')
  }
}

const ROLE_LABEL: Record<string, string> = {
  school_admin: '学校管理员',
  grade_admin: '年级管理员',
  class_admin: '班级管理员',
}
const SCOPE_LABEL: Record<string, string> = { school: '学校', grade: '年级', class: '班级' }

async function enterOrg() {
  const t = confirmEnterOrg.value
  if (!t || entering.value) return
  entering.value = true
  try {
    const res = await $fetch<{
      success: boolean
      admin: { username: string; role: string; schoolName: string }
      nodeName: string
      matchedScope: string
      fallback: boolean
      bypassedSecurity: boolean
    }>('/api/admin/impersonation/enter', {
      method: 'POST',
      body: { schoolId: t.schoolId, scope: t.nodeKind, gradeId: t.gradeId, classId: t.classId },
    })
    confirmEnterOrg.value = null

    let msg = `已以 ${res.admin.username}（${ROLE_LABEL[res.admin.role] || res.admin.role}）身份进入${SCOPE_LABEL[res.matchedScope] || ''}「${res.nodeName}」`
    if (res.fallback) msg += '（该层级无管理员，已向上回退）'
    if (res.bypassedSecurity) msg += '（该账号未完成安全初始化）'
    toast.success(msg)

    await refreshNuxtData('auth-me')
    await navigateTo('/admin')
  } catch (err: any) {
    toast.error(err?.data?.message || err?.data?.statusMessage || '进入组织失败')
  } finally {
    entering.value = false
  }
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
        meta: { schoolId: s.id },
        children: h.grades.map((g) => {
          const cls = h.classes.filter((c) => c.gradeId === g.id)
          return {
            id: `grade-${s.id}-${g.id}`,
            label: g.name,
            sub: `${cls.length} 个班级`,
            kind: 'grade' as const,
            meta: { schoolId: s.id, gradeId: g.id, classCount: cls.length },
            children: cls.map((c) => ({
              id: `class-${s.id}-${c.id}`,
              label: c.name,
              kind: 'class' as const,
              meta: { schoolId: s.id, gradeId: g.id, classId: c.id },
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
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
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
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 class="text-sm font-bold text-slate-100">组织结构</h2>
          <div class="flex flex-wrap items-center gap-3 text-xs">
            <div class="flex items-center gap-1">
              <button type="button" class="org-tool" title="缩小" @click="zoomBy(0.8)">−</button>
              <span class="w-10 text-center text-slate-400 tabular-nums">{{ zoomPercent }}%</span>
              <button type="button" class="org-tool" title="放大" @click="zoomBy(1.25)">+</button>
              <button type="button" class="org-tool" title="复位视图" @click="resetView">复位</button>
            </div>
            <span class="text-slate-700">|</span>
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
        <div
          v-else
          ref="canvasEl"
          class="org-canvas"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
          @wheel.prevent="onWheel"
          @click.capture="onClickCapture"
          @contextmenu.prevent
        >
          <div
            ref="stageEl"
            class="org-stage"
            :style="{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }"
          >
            <OrgChart :node="orgTree" :collapsed="collapsed" @toggle="toggleOrg" @menu="openNodeMenu" />
          </div>
        </div>
        <p v-if="!orgLoading" class="mt-2 text-[11px] text-slate-600">拖拽平移 · 滚轮缩放 · 点击节点收起/展开</p>
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
      <!-- 组织节点右键菜单（学校 / 年级 / 班级） -->
      <Teleport to="body">
        <div
          v-if="orgMenu && menuNode"
          id="org-node-menu"
          class="fixed z-50 w-44 overflow-hidden rounded-lg border border-slate-700/60 bg-[#0f1726] py-1 shadow-2xl"
          :style="{ left: orgMenu.x + 'px', top: orgMenu.y + 'px' }"
        >
          <div class="border-b border-slate-700/50 px-3 py-2">
            <div class="truncate text-xs font-semibold text-slate-200">{{ menuNode.label }}</div>
            <div class="mt-0.5 text-[10px] text-slate-500">
              {{ menuKindLabel }}<span v-if="menuSchool"> · ID {{ menuSchool.id }}</span><span v-if="menuSchool?.disabled === 1"> · 已封禁</span>
            </div>
          </div>

          <!-- 封禁 / 启用仅学校层级支持 -->
          <button v-if="menuNode.kind === 'school'" type="button" class="org-menu-item" @click="menuToggleDisable">
            {{ menuSchool?.disabled === 1 ? '启用学校' : '封禁学校' }}
          </button>

          <button type="button" class="org-menu-item !text-red-400" @click="menuDelete">
            {{ menuNode.kind === 'school' ? '删除学校' : menuNode.kind === 'grade' ? '删除年级' : '删除班级' }}
          </button>
          <button type="button" class="org-menu-item" @click="menuManage">进入管理页</button>
          <div class="my-1 border-t border-slate-700/50"></div>
          <button
            type="button"
            class="org-menu-item !text-brand-400"
            :disabled="menuSchool?.disabled === 1"
            :class="{ 'opacity-40 cursor-not-allowed': menuSchool?.disabled === 1 }"
            @click="menuEnter"
          >
            进入组织
          </button>
        </div>
      </Teleport>

      <!-- 封禁 / 启用确认（仅学校） -->
      <UiConfirm
        :show="!!confirmToggleSchool"
        :title="confirmToggleSchool?.disabled === 1 ? '启用学校' : '封禁学校'"
        :message="confirmToggleSchool ? `确定要${confirmToggleSchool.disabled === 1 ? '启用' : '封禁'}学校「${confirmToggleSchool.name}」吗？` : ''"
        :danger="confirmToggleSchool?.disabled !== 1"
        @confirm="confirmToggleSchoolDisabled"
        @cancel="confirmToggleSchool = null"
      />

      <!-- 进入组织确认 -->
      <UiConfirm
        :show="!!confirmEnterOrg"
        title="进入组织"
        :message="confirmEnterOrg ? `将免密进入${SCOPE_LABEL[confirmEnterOrg.nodeKind]}「${confirmEnterOrg.nodeName}」。优先选择该层级已完成安全初始化的管理员；若该层级无管理员会向上回退。进入后顶部显示「退出模拟」，可一键恢复超管身份。` : ''"
        confirm-text="进入"
        @confirm="enterOrg"
        @cancel="confirmEnterOrg = null"
      />

      <!-- 删除学校（与学校管理页共用同一个三层确认弹窗） -->
      <DeleteSchoolModal
        :show="!!deletingSchool"
        :school="deletingSchool"
        @close="deletingSchool = null"
        @deleted="reloadOrgData"
      />

      <!-- 删除年级 / 班级（密码二次确认 + 级联影响提示） -->
      <DeleteOrgNodeModal
        :show="!!deletingOrg"
        :target="deletingOrg"
        @close="deletingOrg = null"
        @deleted="reloadOrgData"
      />
    </section>
  </div>
</template>

<style scoped>
/* 可拖拽 / 缩放的组织图画布 */
.org-canvas {
  position: relative;
  height: 520px;
  overflow: hidden;
  cursor: grab;
  touch-action: pan-y;
  user-select: none;
  border: 1px solid #16202f;
  border-radius: 10px;
  background: #0a111b;
}
.org-canvas:active {
  cursor: grabbing;
}
.org-stage {
  position: absolute;
  top: 0;
  left: 0;
  padding: 18px;
  transform-origin: 0 0;
  will-change: transform;
}
.org-tool {
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border: 1px solid #24334a;
  border-radius: 6px;
  background: #0f1726;
  color: #c2cfe0;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.org-tool:hover {
  border-color: #355072;
  background: #142033;
}
.org-menu-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 7px 12px;
  font-size: 12px;
  line-height: 1.2;
  text-align: left;
  color: #c2cfe0;
  transition: background 0.12s ease;
}
.org-menu-item:hover:not(:disabled) {
  background: rgba(74, 122, 181, 0.15);
}
</style>
