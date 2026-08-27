<script setup lang="ts">
import { X, RefreshCw, Eye, Edit, KeyRound, Ban, CircleCheck } from '~/utils/icons'
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

// 启用 / 封禁
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
    toast.success(`学生已${newStatus === 1 ? '封禁' : '启用'}`)
    confirmToggle.value = null
    await loadStudents()
  } catch (err) { toast.error(err.data?.message || err.data?.statusMessage || '操作失败') }
}

// 详情
const showDetail = ref(false)
const detailStudent = ref<any>(null)
const detailLogs = ref<any[]>([])
const detailLoading = ref(false)
function openDetail(s: any) {
  detailStudent.value = s
  showDetail.value = true
  detailLogs.value = []
  detailLoading.value = true
  $fetch<{ data: any[] }>(`/api/admin/students/${s.id}/logs`, {
    query: { schoolId: s.schoolId, limit: 10 },
  }).then((res) => { detailLogs.value = res.data || [] })
    .catch(() => { detailLogs.value = [] })
    .finally(() => { detailLoading.value = false })
}

// 编辑资料（姓名 + 邮箱 + 班级调动）
const showEdit = ref(false)
const editStudent = ref<any>(null)
const editEmail = ref('')
const editName = ref('')
const editClassId = ref<number | ''>('')
const editClasses = ref<{ id: number; name: string; gradeName: string }[]>([])
const editLoading = ref(false)
async function loadEditClasses(schoolId: number) {
  try {
    const res = await $fetch<{ data: { id: number; name: string; gradeName: string }[] }>('/api/classes', {
      params: { schoolId },
    })
    editClasses.value = res.data
  } catch { editClasses.value = [] }
}
function openEdit(s: any) {
  editStudent.value = s
  editEmail.value = s.email || ''
  editName.value = s.actualName || ''
  editClassId.value = s.classId ?? ''
  showEdit.value = true
  loadEditClasses(s.schoolId)
}
async function saveProfile() {
  if (editName.value.trim() === '') { toast.error('姓名不能为空'); return }
  if (editEmail.value && !EMAIL_RE.test(editEmail.value.trim())) { toast.error('邮箱格式不正确'); return }
  if (editClassId.value === '') { toast.error('请选择班级'); return }
  editLoading.value = true
  try {
    await $fetch(`/api/admin/students/${editStudent.value.id}`, {
      method: 'PATCH',
      query: { schoolId: editStudent.value.schoolId },
      body: {
        actualName: editName.value.trim(),
        email: editEmail.value.trim() || null,
        classId: Number(editClassId.value),
      },
    })
    toast.success('资料已更新')
    showEdit.value = false
    await loadStudents()
  } catch (err) { toast.error(err.data?.message || err.data?.statusMessage || '更新失败') }
  finally { editLoading.value = false }
}

// 重置密码
const confirmReset = ref<any>(null)
const resetResult = ref<any>(null)
function askReset(s: any) { confirmReset.value = s }
async function doReset() {
  const s = confirmReset.value
  if (!s) return
  try {
    const res = await $fetch<{ data: any }>(`/api/admin/students/${s.id}/reset-password`, {
      method: 'POST',
      query: { schoolId: s.schoolId },
    })
    resetResult.value = res.data
    confirmReset.value = null
  } catch (err) { toast.error(err.data?.message || err.data?.statusMessage || '重置失败') }
}
async function copyPassword() {
  if (!resetResult.value?.password) return
  try {
    await navigator.clipboard.writeText(resetResult.value.password)
    toast.success('已复制临时密码')
  } catch { toast.error('复制失败，请手动选择') }
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
        <p class="text-sm text-slate-500">跨校查看与管理学生账号，支持详情查看、资料编辑、密码重置与账号启停</p>
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
              <option value="disabled">已封禁</option>
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
                  <span v-if="s.disabled === 1" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-500/10 text-red-400">已封禁</span>
                  <span v-else class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-500/10 text-emerald-400">正常</span>
                </td>
                <td class="text-xs text-slate-500">{{ s.createdAt ? formatDate(s.createdAt) : '-' }}</td>
                <td>
                  <div class="flex flex-wrap items-center gap-1">
                    <button @click="openDetail(s)" class="btn btn-ghost text-xs py-1 px-2 text-slate-300 hover:!bg-slate-700/40"><MorphIcon :icon="Eye" :size="13" class="pointer-events-none" /> 详情</button>
                    <button v-if="s.disabled !== 1" @click="askToggle(s)" class="btn btn-ghost text-xs py-1 px-2 !text-red-400 hover:!bg-red-500/10"><MorphIcon :icon="Ban" :size="13" class="pointer-events-none" /> 封禁</button>
                    <button v-else @click="askToggle(s)" class="btn btn-ghost text-xs py-1 px-2 !text-emerald-400 hover:!bg-emerald-500/10"><MorphIcon :icon="CircleCheck" :size="13" class="pointer-events-none" /> 启用</button>
                    <button @click="openEdit(s)" class="btn btn-ghost text-xs py-1 px-2 text-brand-400 hover:!bg-brand-500/10"><MorphIcon :icon="Edit" :size="13" class="pointer-events-none" /> 编辑</button>
                    <button @click="askReset(s)" class="btn btn-ghost text-xs py-1 px-2 text-amber-400 hover:!bg-amber-500/10"><MorphIcon :icon="KeyRound" :size="13" class="pointer-events-none" /> 重置密码</button>
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

    <!-- 编辑资料弹窗（姓名 + 邮箱 + 班级调动） -->
    <ClientOnly>
      <Teleport to="body">
        <div v-if="showEdit" class="modal-backdrop" @click.self="showEdit = false">
          <div class="modal-content max-w-md">
            <div class="modal-header">
              <h3 class="text-base font-bold text-slate-100">编辑资料</h3>
              <button @click="showEdit = false" class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500"><MorphIcon name="x" :size="16" class="pointer-events-none" /></button>
            </div>
            <div class="modal-body space-y-4">
              <p class="text-xs text-slate-500">
                学校：<span class="text-slate-300">{{ editStudent?.schoolName }}</span> ·
                用户：<span class="text-slate-300">{{ editStudent?.username }}</span>
              </p>
              <div>
                <label class="block text-xs text-slate-400 mb-1.5">姓名</label>
                <input v-model="editName" type="text" placeholder="学生姓名" class="form-input text-sm" />
              </div>
              <div>
                <label class="block text-xs text-slate-400 mb-1.5">绑定邮箱（留空则解绑）</label>
                <input v-model="editEmail" type="email" placeholder="未绑定" class="form-input text-sm" />
              </div>
              <div>
                <label class="block text-xs text-slate-400 mb-1.5">所属班级（调动）</label>
                <select v-model="editClassId" class="form-input text-sm">
                  <option :value="''">请选择班级</option>
                  <option v-for="c in editClasses" :key="c.id" :value="c.id">
                    {{ c.gradeName ? c.gradeName + ' / ' : '' }}{{ c.name }}
                  </option>
                </select>
                <p v-if="editClasses.length === 0" class="text-xs text-slate-500 mt-1">该学校暂无班级数据</p>
              </div>
            </div>
            <div class="modal-footer">
              <button @click="showEdit = false" class="btn btn-ghost">取消</button>
              <button @click="saveProfile" :disabled="editLoading" class="btn btn-primary">
                <span v-if="editLoading" class="flex items-center gap-2"><MorphIcon :icon="RefreshCw" :size="14" class="animate-spin" /> 保存中...</span>
                <span v-else>保存</span>
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </ClientOnly>

    <!-- 学生详情弹窗 -->
    <ClientOnly>
      <Teleport to="body">
        <div v-if="showDetail" class="modal-backdrop" @click.self="showDetail = false">
          <div class="modal-content max-w-lg">
            <div class="modal-header">
              <h3 class="text-base font-bold text-slate-100">学生详情</h3>
              <button @click="showDetail = false" class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500"><MorphIcon name="x" :size="16" class="pointer-events-none" /></button>
            </div>
            <div class="modal-body space-y-5">
              <div v-if="detailStudent" class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div><span class="text-slate-500">学校</span><div class="text-slate-200">{{ detailStudent.schoolName }}</div></div>
                <div><span class="text-slate-500">用户名</span><div class="text-slate-200">{{ detailStudent.username }}</div></div>
                <div><span class="text-slate-500">姓名</span><div class="text-slate-200">{{ detailStudent.actualName || '-' }}</div></div>
                <div><span class="text-slate-500">邮箱</span><div class="text-slate-200">{{ detailStudent.email || '未绑定' }}</div></div>
                <div><span class="text-slate-500">年级</span><div class="text-slate-200">{{ detailStudent.gradeName || '-' }}</div></div>
                <div><span class="text-slate-500">班级</span><div class="text-slate-200">{{ detailStudent.className || '-' }}</div></div>
                <div><span class="text-slate-500">状态</span><div class="text-slate-200">{{ detailStudent.disabled === 1 ? '已封禁' : '正常' }}</div></div>
                <div><span class="text-slate-500">创建时间</span><div class="text-slate-200">{{ detailStudent.createdAt ? formatDate(detailStudent.createdAt) : '-' }}</div></div>
              </div>

              <div>
                <div class="text-xs font-semibold text-slate-400 mb-2">分数统计</div>
                <div class="grid grid-cols-4 gap-2">
                  <div class="rounded-lg bg-slate-800/60 px-3 py-2 text-center">
                    <div class="text-lg font-bold text-slate-100">{{ detailStudent?.totalScore ?? 0 }}</div>
                    <div class="text-[11px] text-slate-500">总分</div>
                  </div>
                  <div class="rounded-lg bg-emerald-500/10 px-3 py-2 text-center">
                    <div class="text-lg font-bold text-emerald-400">+{{ detailStudent?.addScore ?? 0 }}</div>
                    <div class="text-[11px] text-slate-500">加分</div>
                  </div>
                  <div class="rounded-lg bg-red-500/10 px-3 py-2 text-center">
                    <div class="text-lg font-bold text-red-400">-{{ detailStudent?.deductScore ?? 0 }}</div>
                    <div class="text-[11px] text-slate-500">扣分</div>
                  </div>
                  <div class="rounded-lg bg-slate-800/60 px-3 py-2 text-center">
                    <div class="text-lg font-bold text-slate-100">{{ detailStudent?.scoreCount ?? 0 }}</div>
                    <div class="text-[11px] text-slate-500">记录数</div>
                  </div>
                </div>
              </div>

              <div>
                <div class="text-xs font-semibold text-slate-400 mb-2">最近加减分记录</div>
                <div v-if="detailLoading" class="text-xs text-slate-500 py-3">加载中...</div>
                <div v-else-if="detailLogs.length === 0" class="text-xs text-slate-500 py-3">暂无记录</div>
                <ul v-else class="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  <li v-for="log in detailLogs" :key="log.id" class="flex items-center justify-between text-sm bg-slate-800/40 rounded-md px-3 py-2">
                    <div class="min-w-0">
                      <div class="text-slate-200 truncate">{{ log.description || '（无描述）' }}</div>
                      <div class="text-[11px] text-slate-500">{{ log.createdAt ? formatDate(log.createdAt) : '' }}</div>
                    </div>
                    <span :class="log.scoreChange >= 0 ? 'text-emerald-400' : 'text-red-400'" class="font-semibold shrink-0 ml-2">
                      {{ log.scoreChange >= 0 ? '+' : '' }}{{ log.scoreChange }}
                    </span>
                  </li>
                </ul>
              </div>
            </div>
            <div class="modal-footer">
              <button @click="showDetail = false" class="btn btn-ghost">关闭</button>
              <button @click="askReset(detailStudent); showDetail = false" class="btn btn-primary"><MorphIcon :icon="KeyRound" :size="14" class="pointer-events-none" /> 重置密码</button>
            </div>
          </div>
        </div>
      </Teleport>
    </ClientOnly>

    <!-- 重置密码结果弹窗 -->
    <ClientOnly>
      <Teleport to="body">
        <div v-if="resetResult" class="modal-backdrop" @click.self="resetResult = null">
          <div class="modal-content max-w-md">
            <div class="modal-header">
              <h3 class="text-base font-bold text-slate-100">密码已重置</h3>
              <button @click="resetResult = null" class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500"><MorphIcon name="x" :size="16" class="pointer-events-none" /></button>
            </div>
            <div class="modal-body space-y-3">
              <p class="text-sm text-slate-300">
                学生 <span class="text-slate-100">{{ resetResult.actualName || resetResult.username }}</span> 的临时密码已生成，请转告学生并提醒其尽快修改。
              </p>
              <div class="flex items-center gap-2 rounded-lg bg-slate-800/60 px-3 py-2.5">
                <code class="flex-1 text-center text-base font-mono tracking-wider text-brand-300 select-all">{{ resetResult.password }}</code>
                <button @click="copyPassword" class="btn btn-ghost text-xs py-1 px-2 text-brand-400 hover:!bg-brand-500/10">复制</button>
              </div>
            </div>
            <div class="modal-footer">
              <button @click="resetResult = null" class="btn btn-primary">知道了</button>
            </div>
          </div>
        </div>
      </Teleport>
    </ClientOnly>

    <!-- 启用 / 封禁确认 -->
    <UiConfirm
      :show="!!confirmToggle"
      :title="confirmToggle?.disabled === 1 ? '启用学生' : '封禁学生'"
      :message="confirmToggle ? `确定要${confirmToggle.disabled === 1 ? '启用' : '封禁'}学生「${confirmToggle.username}」吗？${confirmToggle.disabled === 1 ? '' : '封禁后将无法登录系统。'}` : ''"
      :danger="confirmToggle?.disabled !== 1"
      @confirm="doToggle"
      @cancel="confirmToggle = null"
    />

    <!-- 重置密码确认 -->
    <UiConfirm
      :show="!!confirmReset"
      title="重置学生密码"
      :message="confirmReset ? `确定要将学生「${confirmReset.username}」的密码重置为系统生成的临时密码吗？重置后学生需用临时密码重新登录。` : ''"
      confirm-text="重置密码"
      @confirm="doReset"
      @cancel="confirmReset = null"
    />
  </div>
</template>
