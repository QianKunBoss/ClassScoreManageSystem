<script setup lang="ts">
import { X, RefreshCw } from '~/utils/icons'
import { formatDate } from '~/utils/format'

definePageMeta({ middleware: 'super-admin', layout: 'superadmin' })

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const toast = useToast()

// 列表 / 筛选 / 分页
const students = ref<any[]>([])
const schools = ref<{ id: number; name: string }[]>([])
const grades = ref<{ id: number; name: string }[]>([])
const classes = ref<{ id: number; name: string }[]>([])
const filterSchoolId = ref<number | ''>('')
const gradeFilter = ref<number | ''>('')
const classFilter = ref<number | ''>('')
const search = ref('')
const statusFilter = ref('')
const page = ref(1)
const limit = ref(20)
const total = ref(0)
const loading = ref(false)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit.value)))

async function loadSchools() {
  try {
    const res = await $fetch<{ data: { id: number; name: string }[] }>('/api/schools', {
      params: { includeDisabled: '1' },
    })
    schools.value = res.data
  } catch { toast.error('加载学校失败') }
}

// 年级 / 班级下拉（仅在选定具体学校时可用，避免跨校 id 歧义）
async function loadGrades() {
  if (!filterSchoolId.value) { grades.value = []; return }
  try {
    const res = await $fetch<{ data: { id: number; name: string }[] }>('/api/grades', {
      params: { schoolId: filterSchoolId.value },
    })
    grades.value = res.data
  } catch { grades.value = [] }
}
async function loadClasses() {
  if (!filterSchoolId.value) { classes.value = []; return }
  try {
    const res = await $fetch<{ data: { id: number; name: string }[] }>('/api/classes', {
      params: gradeFilter.value
        ? { schoolId: filterSchoolId.value, gradeId: gradeFilter.value }
        : { schoolId: filterSchoolId.value },
    })
    classes.value = res.data
  } catch { classes.value = [] }
}

async function loadStudents() {
  loading.value = true
  try {
    const res = await $fetch<{ data: any[]; total: number; page: number; limit: number }>('/api/admin/students', {
      query: {
        page: page.value,
        limit: limit.value,
        search: search.value || undefined,
        status: statusFilter.value || undefined,
        schoolId: filterSchoolId.value || undefined,
        gradeId: gradeFilter.value || undefined,
        classId: classFilter.value || undefined,
      },
    })
    students.value = res.data
    total.value = res.total
  } catch { toast.error('加载学生失败') }
  finally { loading.value = false }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 1; loadStudents() }, 300)
}

watch(filterSchoolId, async () => {
  gradeFilter.value = ''
  classFilter.value = ''
  await loadGrades()
  await loadClasses()
})
watch(gradeFilter, async () => {
  classFilter.value = ''
  await loadClasses()
})
watch([statusFilter, gradeFilter, classFilter, page, limit], () => loadStudents())

// 启用 / 禁用
const confirmToggle = ref<any>(null)
function askToggle(s: any) { confirmToggle.value = s }
async function doToggle() {
  const s = confirmToggle.value
  if (!s) return
  const newStatus = s.disabled === 1 ? 0 : 1
  try {
    await $fetch(`/api/admin/students/${s.id}`, {
      method: 'PATCH',
      query: { schoolId: s.schoolId },
      body: { disabled: newStatus },
    })
    toast.success(`学生已${newStatus === 1 ? '禁用' : '启用'}`)
    confirmToggle.value = null
    await loadStudents()
  } catch (err) { toast.error(err.data?.message || err.data?.statusMessage || '操作失败') }
}

// 编辑邮箱
const showEdit = ref(false)
const editStudent = ref<any>(null)
const editEmail = ref('')
const editLoading = ref(false)
function openEdit(s: any) {
  editStudent.value = s
  editEmail.value = s.email || ''
  showEdit.value = true
}
async function saveEmail() {
  if (editEmail.value && !EMAIL_RE.test(editEmail.value.trim())) { toast.error('邮箱格式不正确'); return }
  editLoading.value = true
  try {
    await $fetch(`/api/admin/students/${editStudent.value.id}`, {
      method: 'PATCH',
      query: { schoolId: editStudent.value.schoolId },
      body: { email: editEmail.value.trim() || null },
    })
    toast.success('邮箱已更新')
    showEdit.value = false
    await loadStudents()
  } catch (err) { toast.error(err.data?.message || err.data?.statusMessage || '更新失败') }
  finally { editLoading.value = false }
}

onMounted(async () => {
  await Promise.all([loadSchools(), loadStudents()])
})
</script>

<template>
  <div>
    <section class="border-b border-slate-800/50">
      <div class="px-4 sm:px-6 lg:px-8 py-6">
        <h1 class="text-xl font-bold text-slate-100 mb-1">学生管理</h1>
        <p class="text-sm text-slate-500">跨校查看与管理学生账号，支持邮箱设置与账号启停</p>
      </div>
    </section>

    <section class="px-4 sm:px-6 lg:px-8 py-8">
      <div class="glass-card p-6 animate-slide-up">
        <div class="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <h2 class="text-sm font-bold text-slate-100 shrink-0">学生列表</h2>
          <div class="flex flex-col items-end gap-2 w-full sm:flex-row sm:flex-nowrap sm:items-center sm:justify-end sm:w-auto sm:gap-2">
            <input v-model="search" @input="onSearchInput" type="text" placeholder="搜索用户名 / 姓名 / 邮箱" class="form-input text-sm py-1.5 w-full sm:w-80" />
            <select v-model="statusFilter" class="form-input text-sm py-1.5 w-full sm:w-40">
              <option value="">全部状态</option>
              <option value="active">正常</option>
              <option value="disabled">已禁用</option>
            </select>
            <select v-model="filterSchoolId" class="form-input text-sm py-1.5 w-full sm:w-40">
              <option :value="''">全部学校</option>
              <option v-for="s in schools" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
            <select v-if="filterSchoolId" v-model="gradeFilter" class="form-input text-sm py-1.5 w-full sm:w-40">
              <option :value="''">全部年级</option>
              <option v-for="g in grades" :key="g.id" :value="g.id">{{ g.name }}</option>
            </select>
            <select v-if="filterSchoolId" v-model="classFilter" class="form-input text-sm py-1.5 w-full sm:w-40">
              <option :value="''">全部班级</option>
              <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>学校</th>
                <th>用户名</th>
                <th>姓名</th>
                <th>年级</th>
                <th>班级</th>
                <th>邮箱</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in students" :key="`${s.schoolId}-${s.id}`" :class="s.disabled === 1 ? 'opacity-60' : ''">
                <td class="text-xs text-slate-400">{{ s.schoolName }}</td>
                <td><span class="text-sm font-medium text-slate-200">{{ s.username }}</span></td>
                <td class="text-xs text-slate-400">{{ s.actualName || '-' }}</td>
                <td class="text-xs text-slate-400">{{ s.gradeName || '-' }}</td>
                <td class="text-xs text-slate-400">{{ s.className || '-' }}</td>
                <td class="text-xs text-slate-400">{{ s.email || '-' }}</td>
                <td>
                  <span v-if="s.disabled === 1" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-500/10 text-red-400">已禁用</span>
                  <span v-else class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-500/10 text-emerald-400">正常</span>
                </td>
                <td class="text-xs text-slate-500">{{ s.createdAt ? formatDate(s.createdAt) : '-' }}</td>
                <td>
                  <div class="flex items-center gap-1">
                    <button v-if="s.disabled !== 1" @click="askToggle(s)" class="btn btn-ghost text-xs py-1 px-2 !text-red-400 hover:!bg-red-500/10">禁用</button>
                    <button v-else @click="askToggle(s)" class="btn btn-ghost text-xs py-1 px-2 !text-emerald-400 hover:!bg-emerald-500/10">启用</button>
                    <button @click="openEdit(s)" class="btn btn-ghost text-xs py-1 px-2 text-brand-400 hover:!bg-brand-500/10">改邮箱</button>
                  </div>
                </td>
              </tr>
              <tr v-if="!loading && students.length === 0">
                <td colspan="9" class="text-center text-sm text-slate-500 py-8">暂无数据</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 分页 -->
        <div class="flex items-center justify-between mt-4 text-xs text-slate-400">
          <span>共 {{ total }} 条 · 第 {{ page }} / {{ totalPages }} 页</span>
          <div class="flex items-center gap-2">
            <select v-model.number="limit" class="form-input text-xs py-1 w-20">
              <option :value="10">10/页</option>
              <option :value="20">20/页</option>
              <option :value="50">50/页</option>
            </select>
            <button :disabled="page <= 1" @click="page--" class="btn btn-ghost text-xs py-1 px-2 disabled:opacity-40">上一页</button>
            <button :disabled="page >= totalPages" @click="page++" class="btn btn-ghost text-xs py-1 px-2 disabled:opacity-40">下一页</button>
          </div>
        </div>
      </div>
    </section>

    <!-- 编辑邮箱弹窗 -->
    <ClientOnly>
      <Teleport to="body">
        <div v-if="showEdit" class="modal-backdrop" @click.self="showEdit = false">
          <div class="modal-content max-w-md">
            <div class="modal-header">
              <h3 class="text-base font-bold text-slate-100">编辑邮箱</h3>
              <button @click="showEdit = false" class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500"><MorphIcon name="x" :size="16" class="pointer-events-none" /></button>
            </div>
            <div class="modal-body space-y-4">
              <p class="text-xs text-slate-500">
                学校：<span class="text-slate-300">{{ editStudent?.schoolName }}</span> ·
                用户：<span class="text-slate-300">{{ editStudent?.username }}</span>
              </p>
              <div>
                <label class="block text-xs text-slate-400 mb-1.5">绑定邮箱（留空则解绑）</label>
                <input v-model="editEmail" type="email" placeholder="未绑定" class="form-input text-sm" @keyup.enter="saveEmail" />
              </div>
            </div>
            <div class="modal-footer">
              <button @click="showEdit = false" class="btn btn-ghost">取消</button>
              <button @click="saveEmail" :disabled="editLoading" class="btn btn-primary">
                <span v-if="editLoading" class="flex items-center gap-2"><MorphIcon :icon="RefreshCw" :size="14" class="animate-spin" /> 保存中...</span>
                <span v-else>保存</span>
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </ClientOnly>

    <!-- 启用 / 禁用确认 -->
    <UiConfirm
      :show="!!confirmToggle"
      :title="confirmToggle?.disabled === 1 ? '启用学生' : '禁用学生'"
      :message="confirmToggle ? `确定要${confirmToggle.disabled === 1 ? '启用' : '禁用'}学生「${confirmToggle.username}」吗？${confirmToggle.disabled === 1 ? '' : '禁用后将无法登录系统。'}` : ''"
      :danger="confirmToggle?.disabled !== 1"
      @confirm="doToggle"
      @cancel="confirmToggle = null"
    />
  </div>
</template>
