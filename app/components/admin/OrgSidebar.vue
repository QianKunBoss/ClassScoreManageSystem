<script setup lang="ts">
import { ChevronRight, ChevronDown, Plus, GraduationCap, Users, LayoutTemplate, Armchair, Star } from '~/utils/icons'
import { useAuth } from '~/composables/useAuth'

const toast = useToast()
const { user } = useAuth()
const role = computed(() => user.value?.role || '')
const isRegularAdmin = computed(() =>
  ['school_admin', 'grade_admin', 'class_admin'].includes(role.value),
)

// 组织树数据
const grades = ref<any[]>([])
const classes = ref<any[]>([])
const loading = ref(false)
const expanded = ref<Record<number, boolean>>({})
const collapsed = ref(true)
const usersCollapsed = ref(true)

const canAddGrade = computed(() => role.value === 'school_admin')
const canAddClass = computed(() =>
  role.value === 'school_admin' || role.value === 'grade_admin',
)

// 按管理员权限裁剪组织树
const tree = computed(() => {
  const r = role.value
  const gid = user.value?.gradeId
  const cid = user.value?.classId
  return grades.value
    .filter((g: any) => r !== 'grade_admin' || g.id === gid)
    .map((g: any) => {
      let cls = classes.value.filter((c: any) => c.gradeId === g.id)
      if (r === 'class_admin') cls = cls.filter((c: any) => c.id === cid)
      return { ...g, classes: cls }
    })
})

async function load() {
  if (!isRegularAdmin.value) return
  loading.value = true
  try {
    const [g, c] = await Promise.all([
      $fetch<{ success: boolean, data: any[] }>('/api/grades'),
      $fetch<{ success: boolean, data: any[] }>('/api/classes'),
    ])
    grades.value = g.data || []
    classes.value = c.data || []
  } catch (e) {
    console.error('加载组织树失败', e)
  } finally {
    loading.value = false
  }
}

// 添加弹窗
const showAdd = ref(false)
const addMode = ref<'grade' | 'class'>('grade')
const addGradeId = ref<number | null>(null)
const addName = ref('')

function openAddGrade() {
  addMode.value = 'grade'
  addGradeId.value = null
  addName.value = ''
  showAdd.value = true
}
function openAddClass(gradeId: number | null = null) {
  addMode.value = 'class'
  addGradeId.value = gradeId ?? (role.value === 'grade_admin' ? user.value?.gradeId ?? null : null)
  addName.value = ''
  showAdd.value = true
}
async function submitAdd() {
  const name = addName.value.trim()
  if (!name) {
    toast.error('请输入名称')
    return
  }
  try {
    if (addMode.value === 'grade') {
      await $fetch('/api/grades', { method: 'POST', body: { name } })
      toast.success('年级创建成功')
    } else {
      if (!addGradeId.value) {
        toast.error('缺少所属年级')
        return
      }
      await $fetch('/api/classes', { method: 'POST', body: { gradeId: addGradeId.value, name } })
      toast.success('班级创建成功')
    }
    showAdd.value = false
    await load()
  } catch (e: any) {
    toast.error(e?.data?.message || e?.data?.statusMessage || '创建失败')
  }
}

function toggle(gid: number) {
  expanded.value[gid] = !expanded.value[gid]
}
function goGrade() {
  navigateTo('/admin/grades')
}
function goClass(c: any) {
  navigateTo(`/admin?classId=${c.id}`)
}

onMounted(load)
watch(() => user.value?.id, (id) => { if (id) load() })
</script>

<template>
  <aside
    v-if="isRegularAdmin"
    class="w-full md:w-60 shrink-0 md:sticky md:top-16 md:h-[calc(100vh-4rem)] border-b md:border-b-0 md:border-r border-slate-800/50 bg-[#0b1220]/60 overflow-y-auto"
  >
    <div class="p-3">
      <!-- 组织 头部 -->
      <div class="flex items-center justify-between py-2">
        <button
          @click="collapsed = !collapsed"
          class="flex items-center gap-1.5 text-slate-200 transition-colors hover:text-brand-400"
        >
          <MorphIcon :icon="collapsed ? ChevronRight : ChevronDown" :size="16" class="shrink-0 pointer-events-none" />
          <MorphIcon :icon="Users" :size="16" class="shrink-0" />
          <span class="text-sm font-semibold">组织</span>
        </button>
        <button
          v-if="canAddGrade || canAddClass"
          @click="canAddGrade ? openAddGrade() : openAddClass()"
          class="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-brand-400 hover:bg-slate-800/50 transition-colors"
          :title="canAddGrade ? '添加年级' : '添加班级'"
        >
          <MorphIcon :icon="Plus" :size="16" class="pointer-events-none" />
        </button>
      </div>

      <template v-if="!collapsed">
        <div v-if="loading" class="px-3 py-6 text-xs text-slate-500">加载中...</div>

        <!-- 组织树 -->
        <div v-else class="space-y-0.5 pl-3">
        <template v-for="g in tree" :key="g.id">
          <div class="group flex items-center gap-1 rounded-lg hover:bg-slate-800/40">
            <button
              v-if="g.classes.length"
              @click="toggle(g.id)"
              class="flex h-8 w-6 shrink-0 items-center justify-center text-slate-500 hover:text-slate-200"
            >
              <MorphIcon :icon="expanded[g.id] ? ChevronDown : ChevronRight" :size="14" class="pointer-events-none" />
            </button>
            <span v-else class="h-8 w-6 shrink-0"></span>

            <button
              @click="goGrade"
              class="flex flex-1 items-center gap-2 py-1.5 pl-1 pr-2 text-left text-sm text-slate-300 transition-colors hover:text-brand-400"
            >
              <MorphIcon :icon="GraduationCap" :size="15" class="shrink-0" />
              <span class="truncate">{{ g.name }}</span>
            </button>

            <button
              v-if="canAddClass && (role === 'school_admin' || g.id === user?.gradeId)"
              @click="openAddClass(g.id)"
              title="在该年级下添加班级"
              class="flex h-8 w-6 shrink-0 items-center justify-center text-slate-500 opacity-0 transition-opacity hover:text-brand-400 group-hover:opacity-100"
            >
              <MorphIcon :icon="Plus" :size="14" class="pointer-events-none" />
            </button>
          </div>

          <!-- 班级 -->
          <div v-if="expanded[g.id]" class="ml-6 space-y-0.5">
            <button
              v-for="c in g.classes"
              :key="c.id"
              @click="goClass(c)"
              class="flex w-full items-center gap-2 rounded-lg py-1.5 pl-2 pr-2 text-left text-sm text-slate-400 transition-colors hover:bg-slate-800/40 hover:text-brand-400"
            >
              <MorphIcon :icon="Users" :size="14" class="shrink-0 opacity-70" />
              <span class="truncate">{{ c.name }}</span>
            </button>
            <p v-if="!g.classes.length" class="py-1 pl-2 text-xs text-slate-600">暂无班级</p>
          </div>
        </template>

        <p v-if="!tree.length" class="px-3 py-4 text-xs text-slate-600">暂无组织数据</p>
      </div>
      </template>

      <!-- 用户管理 头部 -->
      <div class="flex items-center justify-between py-2 mt-1">
        <button
          @click="usersCollapsed = !usersCollapsed"
          class="flex items-center gap-1.5 text-slate-200 transition-colors hover:text-brand-400"
        >
          <MorphIcon :icon="usersCollapsed ? ChevronRight : ChevronDown" :size="16" class="shrink-0 pointer-events-none" />
          <MorphIcon :icon="Users" :size="16" class="shrink-0" />
          <span class="text-sm font-semibold">用户管理</span>
        </button>
      </div>

      <template v-if="!usersCollapsed">
        <div class="space-y-0.5 pl-3">
          <button
            @click="navigateTo('/admin/users')"
            class="flex w-full items-center gap-2 rounded-lg py-1.5 pl-1 pr-2 text-left text-sm text-slate-300 transition-colors hover:bg-slate-800/40 hover:text-brand-400"
          >
            <MorphIcon :icon="GraduationCap" :size="15" class="shrink-0" />
            <span class="truncate">学生管理</span>
          </button>
          <button
            v-if="role === 'school_admin' || role === 'grade_admin'"
            @click="navigateTo('/admin/teachers')"
            class="flex w-full items-center gap-2 rounded-lg py-1.5 pl-1 pr-2 text-left text-sm text-slate-300 transition-colors hover:bg-slate-800/40 hover:text-brand-400"
          >
            <MorphIcon :icon="Users" :size="15" class="shrink-0" />
            <span class="truncate">教师管理</span>
          </button>
        </div>
      </template>

      <!-- 模板管理 -->
      <button
        @click="navigateTo('/admin/templates')"
        class="mt-1 flex w-full items-center gap-2 rounded-lg py-1.5 pl-1 pr-2 text-left text-sm text-slate-300 transition-colors hover:bg-slate-800/40 hover:text-brand-400"
      >
        <MorphIcon :icon="LayoutTemplate" :size="15" class="shrink-0" />
        <span class="truncate">模板管理</span>
      </button>

      <!-- 座位管理 -->
      <button
        @click="navigateTo('/admin/seats')"
        class="flex w-full items-center gap-2 rounded-lg py-1.5 pl-1 pr-2 text-left text-sm text-slate-300 transition-colors hover:bg-slate-800/40 hover:text-brand-400"
      >
        <MorphIcon :icon="Armchair" :size="15" class="shrink-0" />
        <span class="truncate">座位管理</span>
      </button>

      <!-- 积分管理 -->
      <button
        @click="navigateTo('/admin/scores')"
        class="flex w-full items-center gap-2 rounded-lg py-1.5 pl-1 pr-2 text-left text-sm text-slate-300 transition-colors hover:bg-slate-800/40 hover:text-brand-400"
      >
        <MorphIcon :icon="Star" :size="15" class="shrink-0" />
        <span class="truncate">积分管理</span>
      </button>
    </div>

    <!-- 添加弹窗 -->
    <ClientOnly>
      <Teleport to="body">
        <div v-if="showAdd" class="modal-backdrop" @click.self="showAdd = false">
          <div class="modal-content max-w-sm">
            <div class="modal-header">
              <h3 class="text-base font-bold text-slate-100">{{ addMode === 'grade' ? '添加年级' : '添加班级' }}</h3>
              <button @click="showAdd = false" class="h-7 w-7 rounded-md text-slate-500 hover:bg-slate-800">
                <MorphIcon name="x" :size="16" class="pointer-events-none" />
              </button>
            </div>
            <div class="modal-body space-y-4">
              <div v-if="addMode === 'class' && addGradeId" class="text-xs text-slate-400">
                所属年级：{{ grades.find((g: any) => g.id === addGradeId)?.name || '-' }}
              </div>
              <div>
                <label class="mb-2 block text-xs uppercase text-slate-400">{{ addMode === 'grade' ? '年级名称' : '班级名称' }}</label>
                <input
                  v-model="addName"
                  type="text"
                  :placeholder="addMode === 'grade' ? '请输入年级名称' : '请输入班级名称'"
                  class="form-input"
                  @keyup.enter="submitAdd"
                />
              </div>
            </div>
            <div class="modal-footer">
              <button @click="showAdd = false" class="btn btn-ghost">取消</button>
              <button @click="submitAdd" class="btn btn-primary">创建</button>
            </div>
          </div>
        </div>
      </Teleport>
    </ClientOnly>
  </aside>
</template>
