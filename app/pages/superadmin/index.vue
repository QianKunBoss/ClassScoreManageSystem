<script setup lang="ts">
import type { OrgNode, StarNode } from '~/types'

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
  void rebuildOrg(new Set())
}

function collapseAllOrg() {
  void rebuildOrg(collapseAllGradeIds())
}

async function toggleOrg(id: string) {
  const before = anchorRect('[data-org-root]')
  const next = new Set(collapsed.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  collapsed.value = next
  await nextTick()
  keepAnchored(before, '[data-org-root]')
}

/** 全量展开/收起时同样锚定根节点位置 */
async function rebuildOrg(next: Set<string>) {
  const before = anchorRect('[data-org-root]')
  collapsed.value = next
  await nextTick()
  keepAnchored(before, '[data-org-root]')
}

// ===== 画布平移 / 缩放 =====
const canvasEl = ref<HTMLElement | null>(null)
const stageEl = ref<HTMLElement | null>(null)
const zoom = ref(1)
const pan = ref({ x: 0, y: 0 })
const MIN_ZOOM = 0.3
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
  if (activeView.value === 'star') {
    fitStage()
    return
  }
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

/**
 * 拖拽在 window 上跟踪，**不使用 setPointerCapture**：
 * 指针捕获会把后续的兼容鼠标事件（含 click）重定向到画布，导致节点点击失效。
 */
function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  dragState = { active: true, moved: false, sx: e.clientX, sy: e.clientY, px: pan.value.x, py: pan.value.y }
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp, { once: true })
  window.addEventListener('pointercancel', onPointerUp, { once: true })
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
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
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

// ===== 组织节点右键菜单（学校 / 年级 / 班级 / 管理员 / 学生）=====
interface OrgMenuState { node: any; x: number; y: number }
const orgMenu = ref<OrgMenuState | null>(null)
const menuNode = computed(() => orgMenu.value?.node || null)
const menuSchool = computed(() => {
  const schoolId = menuNode.value?.meta?.schoolId
  if (schoolId == null) return null
  return schools.value.find((s) => s.id === schoolId) || null
})
const menuKindLabel = computed(() =>
  ({ school: '学校', grade: '年级', class: '班级', admin: '管理员', student: '学生' } as Record<string, string>)[menuNode.value?.kind || ''] || '',
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

function gotoAdminsPage() {
  closeOrgMenu()
  navigateTo('/superadmin/admins')
}

/** 学生节点：跳转到学生管理页并直接打开对应弹窗 */
function openStudentPage(action: 'detail' | 'edit' | 'reset') {
  const n = menuNode.value
  if (!n?.meta?.studentId) return
  closeOrgMenu()
  navigateTo({
    path: '/superadmin/students',
    query: {
      schoolId: String(n.meta.schoolId),
      studentId: String(n.meta.studentId),
      action,
    },
  })
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
  if (adminLoaded.value && !hasOrgAdmin(n)) {
    toast.error('该层级暂无对应管理员，无法进入')
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

// ===== 视图切换：组织结构 / 用户星图 =====
type ViewKey = 'org' | 'star'
const activeView = ref<ViewKey>('org')
const slideName = ref<'view-right' | 'view-left'>('view-right')

const { user: currentUser } = useAuth()
const currentUserName = computed(() => currentUser.value?.username || '我')

function switchView(v: ViewKey) {
  if (v === activeView.value) return
  slideName.value = v === 'star' ? 'view-right' : 'view-left'
  activeView.value = v
  if (v === 'star') void loadStarData()
}

function onViewEnter() {
  nextTick(() => {
    if (activeView.value === 'star') fitStage()
    else {
      zoom.value = 1
      centerStage()
    }
  })
}

/** 星图整体缩放到画布内（不放大，只缩小） */
function fitStage() {
  const c = canvasEl.value
  const s = stageEl.value
  if (!c || !s) return
  const rect = c.getBoundingClientRect()
  if (!s.offsetWidth || !s.offsetHeight) return
  const z = Math.min(
    1,
    (rect.width - 24) / s.offsetWidth,
    (rect.height - 24) / s.offsetHeight,
  )
  zoom.value = Math.max(MIN_ZOOM, z)
  nextTick(centerStage)
}

// ===== 用户星图数据 =====
const adminList = ref<any[]>([])
const adminLoaded = ref(false)
const starLoaded = ref(false)
const studentTotals = ref<Record<number, number>>({})
const studentsByClass = ref<Record<string, any[]>>({})
const starExpanded = ref<Set<string>>(new Set())
const starLoading = ref(false)

const ROLE_ORDER = [
  { role: 'school_admin', label: '学校管理员' },
  { role: 'grade_admin', label: '年级管理员' },
  { role: 'class_admin', label: '班级管理员' },
]

async function loadAdminList() {
  if (adminLoaded.value) return
  try {
    const a = await $fetch<{ data: any[] }>('/api/admin/manage', { params: { limit: 100 } })
    adminList.value = a.data || []
    adminLoaded.value = true
  } catch {
    toast.error('加载管理员数据失败')
  }
}

async function loadStarData() {
  if (starLoaded.value) return
  starLoading.value = true
  await loadAdminList()

  const totals = await Promise.all(schools.value.map(async (s) => {
    try {
      const r = await $fetch<{ total: number }>('/api/users', { params: { schoolId: s.id, limit: 1 } })
      return [s.id, Number(r.total) || 0] as const
    } catch {
      return [s.id, 0] as const
    }
  }))
  studentTotals.value = Object.fromEntries(totals)

  // 默认展开：根 → 管理员/学生 → 学校 → 角色（直接看到具体账号）
  const exp = new Set<string>(['star-root', 'star-admin', 'star-student'])
  for (const s of schools.value) {
    if (adminList.value.some((a) => a.schoolId === s.id)) exp.add(`star-admin-school-${s.id}`)
    exp.add(`star-student-school-${s.id}`)
    for (const r of ROLE_ORDER) {
      if (adminList.value.some((a) => a.schoolId === s.id && a.role === r.role)) {
        exp.add(`star-role-${s.id}-${r.role}`)
      }
    }
  }
  starExpanded.value = exp
  starLoaded.value = true
  starLoading.value = false
}

/** 目标层级是否确实有对应管理员（严格匹配，不回退） */
function hasOrgAdmin(node: any): boolean {
  const meta = node?.meta
  if (!meta || meta.schoolId == null) return false
  const { schoolId } = meta
  if (node.kind === 'school') {
    return adminList.value.some((a) => a.role === 'school_admin' && a.schoolId === schoolId && a.disabled !== 1)
  }
  if (node.kind === 'grade') {
    return adminList.value.some((a) => a.role === 'grade_admin' && a.schoolId === schoolId && a.gradeId === meta.gradeId && a.disabled !== 1)
  }
  if (node.kind === 'class') {
    return adminList.value.some((a) => a.role === 'class_admin' && a.schoolId === schoolId && a.classId === meta.classId && a.disabled !== 1)
  }
  return false
}

const starTree = computed<StarNode>(() => {
  const totalAdmins = adminList.value.length
  const totalStudents = Object.values(studentTotals.value).reduce((a, b) => a + b, 0)

  const adminSchools: StarNode[] = schools.value
    .map((s): StarNode | null => {
      const list = adminList.value.filter((a) => a.schoolId === s.id)
      if (!list.length) return null
      return {
        id: `star-admin-school-${s.id}`,
        label: s.name,
        sub: `${list.length} 人`,
        kind: 'school',
        tone: 'brand',
        meta: { schoolId: s.id },
        children: ROLE_ORDER.map((r): StarNode | null => {
          const members = list.filter((a) => a.role === r.role)
          if (!members.length) return null
          return {
            id: `star-role-${s.id}-${r.role}`,
            label: r.label,
            sub: `${members.length} 人`,
            kind: 'role',
            tone: 'muted',
            meta: { schoolId: s.id },
            children: members.map((a): StarNode => ({
              id: `star-admin-${a.id}`,
              label: a.username,
              sub: a.disabled === 1 ? '已封禁' : '',
              kind: 'admin',
              tone: 'brand',
              disabled: a.disabled === 1,
              meta: { adminId: a.id, schoolId: s.id },
            })),
          }
        }).filter((x): x is StarNode => !!x),
      }
    })
    .filter((x): x is StarNode => !!x)

  const studentSchools: StarNode[] = schools.value
    .filter((s) => (studentTotals.value[s.id] || 0) > 0)
    .map((s): StarNode => {
      const classList = hierarchy.value[s.id]?.classes || []
      return {
        id: `star-student-school-${s.id}`,
        label: s.name,
        sub: `${studentTotals.value[s.id]} 人`,
        kind: 'school',
        tone: 'emerald',
        meta: { schoolId: s.id },
        children: classList.map((c): StarNode => {
          const key = `${s.id}:${c.id}`
          const loaded = studentsByClass.value[key]
          return {
            id: `star-class-${s.id}-${c.id}`,
            label: c.name,
            sub: loaded ? `${loaded.length} 人` : '',
            kind: 'class',
            tone: 'emerald',
            meta: { schoolId: s.id, gradeId: c.gradeId, classId: c.id },
            children: loaded?.map((u): StarNode => ({
              id: `star-student-${s.id}-${u.id}`,
              label: u.username,
              sub: u.disabled === 1 ? '已封禁' : '',
              kind: 'student',
              tone: 'emerald',
              disabled: u.disabled === 1,
              meta: { schoolId: s.id, classId: c.id, studentId: u.id },
            })),
          }
        }),
      }
    })

  return {
    id: 'star-root',
    label: '我',
    sub: currentUserName.value,
    kind: 'root',
    tone: 'brand',
    children: [
      { id: 'star-admin', label: '管理员', sub: `${totalAdmins} 人`, kind: 'group', tone: 'brand', children: adminSchools },
      { id: 'star-student', label: '学生', sub: `${totalStudents} 人`, kind: 'group', tone: 'emerald', children: studentSchools },
    ],
  }
})

/** 展开班级时按需加载学生 */
async function loadClassStudents(schoolId: number, classId: number) {
  const key = `${schoolId}:${classId}`
  const r = await $fetch<{ data: any[] }>('/api/users', { params: { schoolId, classId, limit: 100 } })
  studentsByClass.value = { ...studentsByClass.value, [key]: r.data || [] }
}

/** 取画布内某个锚点节点的屏幕位置（用于布局变化时锚定，避免整图跳动） */
function anchorRect(selector: string): DOMRect | null {
  const el = stageEl.value?.querySelector(selector)
  return el ? el.getBoundingClientRect() : null
}

/** 布局变化后平移画布，让锚点节点停留在原来的屏幕位置 */
function keepAnchored(before: DOMRect | null, selector: string) {
  const after = anchorRect(selector)
  if (!before || !after) return
  const dx = before.left - after.left
  const dy = before.top - after.top
  if (dx || dy) pan.value = { x: pan.value.x + dx, y: pan.value.y + dy }
}

async function toggleStarNode(id: string) {
  const SEL = '[data-star-root]'
  const before = anchorRect(SEL)
  const next = new Set(starExpanded.value)

  if (next.has(id)) {
    next.delete(id)
    starExpanded.value = next
    await nextTick()
    keepAnchored(before, SEL)
    return
  }

  next.add(id)
  starExpanded.value = next
  await nextTick()
  keepAnchored(before, SEL)

  if (id.startsWith('star-class-')) {
    const parts = id.split('-')
    const schoolId = Number(parts[2])
    const classId = Number(parts[3])
    const key = `${schoolId}:${classId}`
    if (!Number.isFinite(schoolId) || !Number.isFinite(classId) || studentsByClass.value[key]) return
    try {
      const beforeLoad = anchorRect(SEL)
      await loadClassStudents(schoolId, classId)
      await nextTick()
      keepAnchored(beforeLoad, SEL)
    } catch {
      toast.error('加载学生失败')
    }
  }
}

function openStarMenu(payload: { node: StarNode; event: MouseEvent }) {
  const n = payload.node
  if (n.kind === 'school' && n.meta?.schoolId != null) {
    // 学校节点复用组织图的菜单
    openNodeMenu({
      node: {
        id: `school-${n.meta.schoolId}`,
        label: n.label,
        kind: 'school',
        meta: { schoolId: n.meta.schoolId },
      } as OrgNode,
      event: payload.event,
    })
    return
  }
  if ((n.kind === 'admin' || n.kind === 'student') && n.meta) {
    const MENU_W = 184
    const MENU_H = 180
    const x = Math.min(payload.event.clientX, window.innerWidth - MENU_W - 8)
    const y = Math.min(payload.event.clientY, window.innerHeight - MENU_H - 8)
    orgMenu.value = { node: { ...n }, x: Math.max(8, x), y: Math.max(8, y) }
  }
}

// ===== 星图节点：封禁/启用 =====
const confirmToggleAdmin = ref<any>(null)
const confirmToggleStudent = ref<any>(null)

function menuToggleAdmin() {
  if (!menuNode.value?.meta?.adminId) return
  confirmToggleAdmin.value = { ...menuNode.value }
  closeOrgMenu()
}

function menuToggleStudent() {
  if (!menuNode.value?.meta?.studentId) return
  confirmToggleStudent.value = { ...menuNode.value }
  closeOrgMenu()
}

async function confirmToggleAdminDisabled() {
  const n = confirmToggleAdmin.value
  if (!n) return
  const next = n.disabled === 1 ? 0 : 1
  try {
    await $fetch(`/api/admin/manage/${n.meta.adminId}`, { method: 'PATCH', body: { disabled: next } })
    toast.success(`管理员已${next === 1 ? '封禁' : '启用'}`)
    confirmToggleAdmin.value = null
    const a = await $fetch<{ data: any[] }>('/api/admin/manage', { params: { limit: 100 } })
    adminList.value = a.data || []
  } catch (err: any) {
    toast.error(err?.data?.message || err?.data?.statusMessage || '操作失败')
  }
}

async function confirmToggleStudentDisabled() {
  const n = confirmToggleStudent.value
  if (!n) return
  const next = n.disabled === 1 ? 0 : 1
  try {
    await $fetch(`/api/users/${n.meta.studentId}`, {
      method: 'PATCH',
      query: { schoolId: n.meta.schoolId },
      body: { disabled: next },
    })
    toast.success(`学生已${next === 1 ? '封禁' : '启用'}`)
    confirmToggleStudent.value = null
    await loadClassStudents(n.meta.schoolId, n.meta.classId)
  } catch (err: any) {
    toast.error(err?.data?.message || err?.data?.statusMessage || '操作失败')
  }
}

async function loginAsAdminFromMenu() {
  const n = menuNode.value
  if (!n?.meta?.adminId) return
  closeOrgMenu()
  try {
    await $fetch(`/api/admin/manage/${n.meta.adminId}/login`, { method: 'POST' })
    await refreshNuxtData('auth-me')
    await navigateTo('/admin')
  } catch (err: any) {
    toast.error(err?.data?.message || err?.data?.statusMessage || '进入失败')
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
    // 管理员清单用于判断各层级是否可「进入组织」
    void loadAdminList()
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

      <!-- 组织结构 / 用户星图 -->
      <div class="glass-card p-6">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <!-- 一体化分段切换（滑块左右滑动） -->
          <div class="seg" role="tablist" aria-label="视图切换">
            <span class="seg-thumb" :class="{ 'is-right': activeView === 'star' }" aria-hidden="true" />
            <button
              type="button"
              role="tab"
              class="seg-btn"
              :class="{ 'is-active': activeView === 'org' }"
              :aria-selected="activeView === 'org'"
              @click="switchView('org')"
            >组织结构</button>
            <button
              type="button"
              role="tab"
              class="seg-btn"
              :class="{ 'is-active': activeView === 'star' }"
              :aria-selected="activeView === 'star'"
              @click="switchView('star')"
            >用户星图</button>
          </div>

          <div class="flex flex-wrap items-center gap-3 text-xs">
            <div class="flex items-center gap-1">
              <button type="button" class="org-tool" title="缩小" @click="zoomBy(0.8)">−</button>
              <span class="w-10 text-center text-slate-400 tabular-nums">{{ zoomPercent }}%</span>
              <button type="button" class="org-tool" title="放大" @click="zoomBy(1.25)">+</button>
              <button type="button" class="org-tool" title="复位视图" @click="resetView">复位</button>
            </div>
            <template v-if="activeView === 'org'">
              <span class="text-slate-700">|</span>
              <span class="text-slate-500">{{ schools.length }} 所学校</span>
              <button type="button" class="text-brand-400 hover:text-brand-300 transition-colors" @click="expandAllOrg">全部展开</button>
              <span class="text-slate-700">/</span>
              <button type="button" class="text-brand-400 hover:text-brand-300 transition-colors" @click="collapseAllOrg">全部收起</button>
            </template>
            <template v-else>
              <span class="text-slate-700">|</span>
              <span class="text-slate-500">{{ adminList.length }} 名管理员</span>
            </template>
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
          @wheel.prevent="onWheel"
          @click.capture="onClickCapture"
          @contextmenu.prevent
        >
          <div
            ref="stageEl"
            class="org-stage"
            :style="{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }"
          >
            <Transition :name="slideName" mode="out-in" @after-enter="onViewEnter">
              <OrgChart
                v-if="activeView === 'org'"
                key="org"
                :node="orgTree"
                :collapsed="collapsed"
                @toggle="toggleOrg"
                @menu="openNodeMenu"
              />
              <div v-else key="star" class="star-wrap">
                <div v-if="starLoading" class="flex h-[420px] w-[420px] items-center justify-center text-xs text-slate-500">
                  星图生成中…
                </div>
                <UserStarMap
                  v-else
                  :root="starTree"
                  :expanded="starExpanded"
                  @toggle="toggleStarNode"
                  @menu="openStarMenu"
                />
              </div>
            </Transition>
          </div>
        </div>
        <p v-if="!orgLoading" class="mt-2 text-[11px] text-slate-600">
          {{ activeView === 'org'
            ? '拖拽平移 · 滚轮缩放 · 点击节点收起/展开 · 右键管理'
            : '以你为中心向外生长 · 拖拽平移 · 滚轮缩放 · 点击节点展开 · 右键管理' }}
        </p>
      </div>

      <!-- 组织节点 / 用户节点右键菜单 -->
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
              {{ menuKindLabel }}
              <span v-if="menuNode.kind === 'school' && menuNode.meta?.schoolId"> · ID {{ menuNode.meta.schoolId }}</span>
              <span v-if="menuNode.disabled"> · 已封禁</span>
            </div>
          </div>

          <!-- 组织节点（学校 / 年级 / 班级） -->
          <template v-if="['school', 'grade', 'class'].includes(menuNode.kind)">
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
              :disabled="menuSchool?.disabled === 1 || (adminLoaded && !hasOrgAdmin(menuNode))"
              :class="{ 'opacity-40 cursor-not-allowed': menuSchool?.disabled === 1 || (adminLoaded && !hasOrgAdmin(menuNode)) }"
              @click="menuEnter"
            >
              进入组织
            </button>
            <p v-if="adminLoaded && !hasOrgAdmin(menuNode)" class="px-3 pb-1.5 text-[10px] leading-snug text-slate-500">
              该层级暂无对应管理员
            </p>
          </template>

          <!-- 管理员账号 -->
          <template v-else-if="menuNode.kind === 'admin'">
            <button
              v-if="menuNode.meta?.adminId !== currentUser?.id"
              type="button"
              class="org-menu-item"
              @click="menuToggleAdmin"
            >{{ menuNode.disabled ? '启用账号' : '封禁账号' }}</button>
            <button
              v-if="menuNode.meta?.adminId !== currentUser?.id && !menuNode.disabled"
              type="button"
              class="org-menu-item !text-brand-400"
              @click="loginAsAdminFromMenu"
            >进入登录</button>
            <button type="button" class="org-menu-item" @click="gotoAdminsPage">查看账号</button>
          </template>

          <!-- 学生账号 -->
          <template v-else-if="menuNode.kind === 'student'">
            <button type="button" class="org-menu-item" @click="menuToggleStudent">
              {{ menuNode.disabled ? '启用学生' : '封禁学生' }}
            </button>
            <button type="button" class="org-menu-item !text-brand-400" @click="openStudentPage('detail')">查看详情</button>
            <button type="button" class="org-menu-item" @click="openStudentPage('edit')">编辑资料</button>
            <button type="button" class="org-menu-item" @click="openStudentPage('reset')">重置密码</button>
          </template>
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
        :message="confirmEnterOrg ? `将免密进入${SCOPE_LABEL[confirmEnterOrg.nodeKind]}「${confirmEnterOrg.nodeName}」，使用该层级的管理员身份。该层级没有对应管理员时将无法进入。进入后顶部显示「退出模拟」，可一键恢复超管身份。` : ''"
        confirm-text="进入"
        @confirm="enterOrg"
        @cancel="confirmEnterOrg = null"
      />

      <!-- 星图：管理员 / 学生封禁确认 -->
      <UiConfirm
        :show="!!confirmToggleAdmin"
        :title="confirmToggleAdmin?.disabled === 1 ? '启用管理员' : '封禁管理员'"
        :message="confirmToggleAdmin ? `确定要${confirmToggleAdmin.disabled === 1 ? '启用' : '封禁'}管理员「${confirmToggleAdmin.label}」吗？` : ''"
        :danger="confirmToggleAdmin?.disabled !== 1"
        @confirm="confirmToggleAdminDisabled"
        @cancel="confirmToggleAdmin = null"
      />
      <UiConfirm
        :show="!!confirmToggleStudent"
        :title="confirmToggleStudent?.disabled === 1 ? '启用学生' : '封禁学生'"
        :message="confirmToggleStudent ? `确定要${confirmToggleStudent.disabled === 1 ? '启用' : '封禁'}学生「${confirmToggleStudent.label}」吗？` : ''"
        :danger="confirmToggleStudent?.disabled !== 1"
        @confirm="confirmToggleStudentDisabled"
        @cancel="confirmToggleStudent = null"
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
  height: 560px;
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

/* 一体化分段切换：两个按钮同处一个容器，滑块左右平移 */
.seg {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 176px;
  padding: 3px;
  border: 1px solid #223148;
  border-radius: 9px;
  background: #0c1420;
}
.seg-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: calc(50% - 3px);
  height: calc(100% - 6px);
  border: 1px solid #355072;
  border-radius: 6px;
  background: #16283d;
  transition: transform 0.32s cubic-bezier(0.22, 0.61, 0.36, 1);
}
.seg-thumb.is-right {
  transform: translateX(100%);
}
.seg-btn {
  position: relative;
  z-index: 1;
  flex: 1 1 0;
  padding: 4px 0;
  font-size: 12px;
  line-height: 1.4;
  text-align: center;
  color: #7f8ea6;
  cursor: pointer;
  transition: color 0.2s ease;
}
.seg-btn.is-active {
  color: #e2ecf9;
}

/* 视图切换：淡出淡入 + 左右位移 */
.view-right-enter-active,
.view-right-leave-active,
.view-left-enter-active,
.view-left-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.view-right-enter-from {
  opacity: 0;
  transform: translateX(18px);
}
.view-right-leave-to {
  opacity: 0;
  transform: translateX(-18px);
}
.view-left-enter-from {
  opacity: 0;
  transform: translateX(-18px);
}
.view-left-leave-to {
  opacity: 0;
  transform: translateX(18px);
}
.star-wrap {
  display: flex;
  justify-content: center;
}
@media (prefers-reduced-motion: reduce) {
  .seg-thumb,
  .seg-btn,
  .view-right-enter-active,
  .view-right-leave-active,
  .view-left-enter-active,
  .view-left-leave-active {
    transition: none;
  }
}
</style>
