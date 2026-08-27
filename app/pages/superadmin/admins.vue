<script setup lang="ts">
import type { Admin, School } from '~/types'
import { formatDate } from '~/utils/format'

definePageMeta({ middleware: 'super-admin', layout: 'superadmin' })

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const toast = useToast()
const { data: authData } = useFetch('/api/auth/me', {
  credentials: 'include', server: false, default: () => ({ success: false, admin: null }),
})
const currentUser = computed(() => authData.value?.admin || null)

// 管理员管理
const admins = ref<Admin[]>([])
const schools = ref<School[]>([])
const filterSchoolId = ref<number | ''>('')
// 年级 / 班级下拉（仅在选定具体学校时可用，避免跨校 id 歧义）
const gradeFilter = ref<number | ''>('')
const classFilter = ref<number | ''>('')
const grades = ref<any[]>([])
const classes = ref<any[]>([])
// 搜索 / 角色 / 状态 / 分页
const search = ref('')
const roleFilter = ref('')
const statusFilter = ref('')
const page = ref(1)
const limit = ref(20)
const total = ref(0)
const loadingList = ref(false)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit.value)))
const showAddAdmin = ref(false)
const newAdmin = ref({ username: '', password: '', role: 'school_admin', schoolId: '' as number | '', gradeId: '' as number | '', classId: '' as number | '' })
const addAdminGrades = ref<any[]>([])
const addAdminClasses = ref<any[]>([])
const addAdminLoading = ref(false)
const confirmDeleteAdmin = ref<Admin | null>(null)
const confirmDeletePassword = ref('')

// 封禁确认
const confirmToggleAdmin = ref<Admin | null>(null)

// 详情弹窗
const showDetail = ref(false)
const detailAdmin = ref<Admin | null>(null)
const detailNewPassword = ref('')
const detailConfirmPassword = ref('')
const detailEmail = ref('')
const detailLoading = ref(false)
// 所属（学校 / 年级 / 班级）可编辑
const detailSchoolId = ref<number | ''>('')
const detailGradeId = ref<number | ''>('')
const detailClassId = ref<number | ''>('')
const detailGrades = ref<any[]>([])
const detailClasses = ref<any[]>([])
const detailAffLoading = ref(false)

async function loadSchools() {
  try {
    const res = await $fetch<{ data: School[] }>('/api/schools', {
      params: { includeDisabled: '1' }
    })
    schools.value = res.data
  } catch { toast.error('加载学校失败') }
}

async function loadGrades() {
  if (!filterSchoolId.value) { grades.value = []; return }
  try {
    const res = await $fetch<{ data: any[] }>('/api/grades', { params: { schoolId: filterSchoolId.value } })
    grades.value = res.data
  } catch { grades.value = [] }
}
async function loadClasses() {
  if (!filterSchoolId.value) { classes.value = []; return }
  try {
    const res = await $fetch<{ data: any[] }>('/api/classes', {
      params: gradeFilter.value ? { schoolId: filterSchoolId.value, gradeId: gradeFilter.value } : { schoolId: filterSchoolId.value },
    })
    classes.value = res.data
  } catch { classes.value = [] }
}

function openDetail(a: Admin) {
  detailAdmin.value = a
  detailEmail.value = a.email || ''
  detailNewPassword.value = ''
  detailConfirmPassword.value = ''
  detailSchoolId.value = a.schoolId ?? ''
  detailGradeId.value = a.gradeId ?? ''
  detailClassId.value = a.classId ?? ''
  showDetail.value = true
  loadDetailGrades()
  loadDetailClasses()
}

// 详情弹窗内的所属联动
async function loadDetailGrades() {
  if (!detailSchoolId.value) { detailGrades.value = []; return }
  try {
    const res = await $fetch<{ data: any[] }>('/api/grades', { params: { schoolId: detailSchoolId.value } })
    detailGrades.value = res.data || []
  } catch { detailGrades.value = [] }
}
async function loadDetailClasses() {
  if (!detailSchoolId.value || !detailGradeId.value) { detailClasses.value = []; return }
  try {
    const res = await $fetch<{ data: any[] }>('/api/classes', { params: { schoolId: detailSchoolId.value, gradeId: detailGradeId.value } })
    detailClasses.value = res.data || []
  } catch { detailClasses.value = [] }
}
watch(detailSchoolId, () => { detailGradeId.value = ''; detailClassId.value = ''; loadDetailGrades(); loadDetailClasses() })
watch(detailGradeId, () => { detailClassId.value = ''; loadDetailClasses() })

async function updateAffiliation() {
  if (!detailAdmin.value) return
  const role = detailAdmin.value.role
  if (role === 'school_admin' && !detailSchoolId.value) { toast.error('学校管理员必须选择学校'); return }
  if (role === 'grade_admin' && (!detailSchoolId.value || !detailGradeId.value)) { toast.error('年级管理员必须选择学校和年级'); return }
  if (role === 'class_admin' && (!detailSchoolId.value || !detailGradeId.value || !detailClassId.value)) { toast.error('班级管理员必须选择学校、年级和班级'); return }
  detailAffLoading.value = true
  try {
    await $fetch(`/api/admin/manage/${detailAdmin.value.id}`, {
      method: 'PATCH',
      body: {
        schoolId: detailSchoolId.value || null,
        gradeId: detailGradeId.value || null,
        classId: detailClassId.value || null,
      },
    })
    toast.success('所属已更新')
    await loadAdmins()
  } catch (err) { toast.error(err.data?.message || err.data?.statusMessage || '更新失败') }
  finally { detailAffLoading.value = false }
}

async function updateEmail() {
  if (detailEmail.value && !EMAIL_RE.test(detailEmail.value.trim())) { toast.error('邮箱格式不正确'); return }
  try {
    await $fetch(`/api/admin/manage/${detailAdmin.value!.id}`, {
      method: 'PATCH',
      body: { email: detailEmail.value.trim() || null },
    })
    toast.success('邮箱已更新')
    await loadAdmins()
  } catch (err) { toast.error(err.data?.message || err.data?.statusMessage || '更新失败') }
}

async function updatePassword() {
  if (!detailNewPassword.value) { toast.error('请输入新密码'); return }
  if (detailNewPassword.value !== detailConfirmPassword.value) { toast.error('两次密码不一致'); return }
  if (detailNewPassword.value.length < 6) { toast.error('密码长度至少6位'); return }
  detailLoading.value = true
  try {
    await $fetch(`/api/admin/manage/${detailAdmin.value!.id}`, {
      method: 'PATCH',
      body: { password: detailNewPassword.value },
    })
    toast.success('密码已更新')
    detailNewPassword.value = ''
    detailConfirmPassword.value = ''
  } catch (err) { toast.error(err.data?.message || err.data?.statusMessage || '更新失败') }
  finally { detailLoading.value = false }
}

async function loginAs(a: Admin) {
  try {
    const res = await $fetch<{ success: boolean; admin: any }>(`/api/admin/manage/${a.id}/login`, { method: 'POST' })
    if (res.success) {
      toast.success(`已切换为 ${a.username}`)
      // 刷新缓存的认证状态，让导航栏立即更新
      await refreshNuxtData('auth-me')
      await navigateTo('/admin', { external: false })
    }
  } catch (err) { toast.error(err.data?.message || err.data?.statusMessage || '登录失败') }
}

// 所属学校显示文本
function schoolDisplay(a: Admin): string {
  if (!a.schoolName) return '-'
  if (a.role === 'school_admin') return `${a.schoolName}-校级`
  if (a.role === 'grade_admin') return `${a.schoolName}-${a.gradeName || '年级'}`
  // 班级管理员：学校-年级-班级
  if (a.role === 'class_admin') return `${a.schoolName}-${a.gradeName || '年级'}-${a.className || '班级'}`
  return a.schoolName
}

// 管理员列表（服务端分页 / 搜索 / 筛选）
async function loadAdmins() {
  loadingList.value = true
  try {
    const res = await $fetch<{ data: Admin[]; total: number; page: number; limit: number }>('/api/admin/manage', {
      query: {
        page: page.value,
        limit: limit.value,
        search: search.value || undefined,
        role: roleFilter.value || undefined,
        status: statusFilter.value || undefined,
        schoolId: filterSchoolId.value || undefined,
        gradeId: (gradeFilter.value || undefined) as any,
        classId: (classFilter.value || undefined) as any,
      },
    })
    admins.value = res.data
    total.value = res.total
  } catch { toast.error('加载管理员失败') }
  finally { loadingList.value = false }
}

// 关键词搜索（防抖）
let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 1; loadAdmins() }, 300)
}

// 筛选 / 分页条件变化即重新加载
watch([roleFilter, statusFilter, gradeFilter, classFilter, filterSchoolId, page, limit], () => {
  loadAdmins()
})

// 选学校 → 重置并加载年级/班级；选年级 → 重置并加载班级
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

async function createAdmin() {
  if (!newAdmin.value.username || !newAdmin.value.password) { toast.error('请填写完整'); return }
  if (newAdmin.value.role === 'school_admin' && !newAdmin.value.schoolId) {
    toast.error('学校管理员必须选择学校'); return
  }
  if (newAdmin.value.role === 'grade_admin' && (!newAdmin.value.schoolId || !newAdmin.value.gradeId)) {
    toast.error('年级管理员必须选择学校和年级'); return
  }
  if (newAdmin.value.role === 'class_admin' && (!newAdmin.value.schoolId || !newAdmin.value.gradeId || !newAdmin.value.classId)) {
    toast.error('班级管理员必须选择学校、年级和班级'); return
  }
  addAdminLoading.value = true
  try {
    await $fetch('/api/admin/manage', {
      method: 'POST',
      body: {
        username: newAdmin.value.username,
        password: newAdmin.value.password,
        role: newAdmin.value.role,
        schoolId: newAdmin.value.schoolId || null,
        gradeId: newAdmin.value.gradeId || null,
        classId: newAdmin.value.classId || null,
      },
    })
    toast.success('管理员已创建')
    showAddAdmin.value = false
    newAdmin.value = { username: '', password: '', role: 'school_admin', schoolId: '', gradeId: '', classId: '' }
    await loadAdmins()
  } catch (err) { toast.error(err.data?.message || err.data?.statusMessage || '创建失败') }
  finally { addAdminLoading.value = false }
}

// 添加管理员弹窗：联动加载年级/班级
async function loadAddAdminGrades() {
  if (!newAdmin.value.schoolId) { addAdminGrades.value = []; return }
  try {
    const res = await $fetch<{ data: any[] }>('/api/grades', { query: { schoolId: newAdmin.value.schoolId } })
    addAdminGrades.value = res.data || []
  } catch { addAdminGrades.value = [] }
}

async function loadAddAdminClasses() {
  if (!newAdmin.value.gradeId) { addAdminClasses.value = []; return }
  try {
    const res = await $fetch<{ data: any[] }>('/api/classes', { query: { gradeId: newAdmin.value.gradeId, schoolId: newAdmin.value.schoolId } })
    addAdminClasses.value = res.data || []
  } catch { addAdminClasses.value = [] }
}

watch(() => newAdmin.value.schoolId, () => {
  newAdmin.value.gradeId = ''
  newAdmin.value.classId = ''
  if (newAdmin.value.role !== 'super_admin') loadAddAdminGrades()
})

watch(() => newAdmin.value.gradeId, () => {
  newAdmin.value.classId = ''
  if (newAdmin.value.role === 'class_admin') loadAddAdminClasses()
})

watch(() => showAddAdmin.value, (open) => {
  if (open) {
    newAdmin.value = { username: '', password: '', role: 'school_admin', schoolId: '', gradeId: '', classId: '' }
    addAdminGrades.value = []
    addAdminClasses.value = []
    if (schools.value.length === 0) loadSchools()
  }
})

async function updateRole(id: number, role: string) {
  try {
    await $fetch(`/api/admin/manage/${id}`, { method: 'PATCH', body: { role } })
    const a = admins.value.find(x => x.id === id)
    const needAff = (role === 'grade_admin' && !a?.gradeId) || (role === 'class_admin' && (!a?.gradeId || !a?.classId))
    toast.success(needAff ? '角色已更新，请点「详情」补全所属学校/年级/班级' : '角色已更新')
    await loadAdmins()
  } catch (err) { toast.error(err.data?.message || '更新失败') }
}

async function deleteAdmin(id: number) {
  if (!confirmDeletePassword.value) { toast.error('请输入确认密码'); return }
  try {
    await $fetch(`/api/admin/manage/${id}`, {
      method: 'DELETE',
      headers: { 'x-confirm-password': confirmDeletePassword.value },
    })
    toast.success('管理员已删除')
    confirmDeleteAdmin.value = null
    confirmDeletePassword.value = ''
    await loadAdmins()
  } catch (err) { toast.error(err.data?.message || '删除失败') }
}

async function toggleAdminDisabled(admin: any) {
  confirmToggleAdmin.value = admin
}

async function confirmToggleAdminDisabled() {
  const admin = confirmToggleAdmin.value
  if (!admin) return
  const newStatus = admin.disabled === 1 ? 0 : 1
  try {
    await $fetch(`/api/admin/manage/${admin.id}`, {
      method: 'PATCH',
      body: { disabled: newStatus },
    })
    toast.success(`管理员已${newStatus === 1 ? '封禁' : '启用'}`)
    confirmToggleAdmin.value = null
    await loadAdmins()
  } catch (err) {
    toast.error(err.data?.message || err.data?.statusMessage || '操作失败')
  }
}

watchEffect(async () => {
  if (currentUser.value?.role === 'super_admin') {
    await Promise.all([loadAdmins(), loadSchools()])
  }
})
</script>

<template>
  <div>
    <section class="border-b border-slate-800/50">
      <div class="px-4 sm:px-6 lg:px-8 py-6">
        <h1 class="text-xl font-bold text-slate-100 mb-1">管理员账号</h1>
        <p class="text-sm text-slate-500">管理系统各级管理员账号，支持免密切换登录</p>
      </div>
    </section>

    <section class="px-4 sm:px-6 lg:px-8 py-8">
      <div class="glass-card p-6 animate-slide-up">
        <div class="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <h2 class="text-sm font-bold text-slate-100 shrink-0">账号列表</h2>
          <div class="flex flex-col items-end gap-2 w-full sm:flex-row sm:flex-nowrap sm:items-center sm:justify-end sm:w-auto sm:gap-2">
            <input v-model="search" @input="onSearchInput" type="text" placeholder="搜索用户名 / 邮箱" class="form-input text-sm py-1.5 w-full sm:w-80" />
            <select v-model="roleFilter" class="form-input text-sm py-1.5 w-full sm:w-40">
              <option value="">全部角色</option>
              <option value="super_admin">超级管理员</option>
              <option value="school_admin">学校管理员</option>
              <option value="grade_admin">年级管理员</option>
              <option value="class_admin">班级管理员</option>
            </select>
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
            <button @click="showAddAdmin = true" class="btn btn-primary text-sm sm:ml-1">+ 添加</button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>用户名</th>
                <th>所属学校</th>
                <th>邮箱</th>
                <th>年级</th>
                <th>班级</th>
                <th>角色</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>最后登录</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in admins" :key="a.id" :class="a.disabled === 1 ? 'opacity-60' : ''">
                <td><span class="text-sm font-medium text-slate-200">{{ a.username }}</span></td>
                <td class="text-xs text-slate-400">{{ a.schoolName || '-' }}</td>
                <td class="text-xs text-slate-400">{{ a.email || '-' }}</td>
                <td class="text-xs text-slate-400">{{ a.gradeName || '-' }}</td>
                <td class="text-xs text-slate-400">{{ a.className || '-' }}</td>
                <td>
                  <select :value="a.role" @change="updateRole(a.id, ($event.target as HTMLSelectElement).value)" :disabled="a.id === currentUser?.id" class="form-input text-sm py-1.5 w-32">
                    <option value="super_admin">超级管理员</option>
                    <option value="school_admin">学校管理员</option>
                    <option value="grade_admin">年级管理员</option>
                    <option value="class_admin">班级管理员</option>
                  </select>
                </td>
                <td>
                  <span v-if="a.disabled === 1" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-500/10 text-red-400">已封禁</span>
                  <span v-else class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-500/10 text-emerald-400">正常</span>
                </td>
                <td class="text-xs text-slate-500">{{ new Date(a.createdAt).toLocaleDateString('zh-CN') }}</td>
                <td class="text-xs text-slate-500">{{ a.lastLogin ? new Date(a.lastLogin).toLocaleDateString('zh-CN') : '从未' }}</td>
                <td>
                  <div class="flex items-center gap-1">
                    <button
                      v-if="a.disabled !== 1 && a.id !== currentUser?.id"
                      @click="toggleAdminDisabled(a)"
                      class="btn btn-ghost text-xs py-1 px-2 !text-red-400 hover:!bg-red-500/10"
                    >
                      封禁
                    </button>
                    <button
                      v-else-if="a.id !== currentUser?.id"
                      @click="toggleAdminDisabled(a)"
                      class="btn btn-ghost text-xs py-1 px-2 !text-emerald-400 hover:!bg-emerald-500/10"
                    >
                      启用
                    </button>
                    <button v-if="a.id !== currentUser?.id && a.disabled !== 1" @click="loginAs(a)" class="btn btn-ghost text-xs py-1 px-2 text-brand-400 hover:!bg-brand-500/10">登录</button>
                    <button @click="openDetail(a)" class="btn btn-ghost text-xs py-1 px-2 text-brand-400 hover:!bg-brand-500/10">详情</button>
                    <button v-if="a.id !== currentUser?.id" @click="confirmDeleteAdmin = a" class="btn btn-ghost text-xs py-1 px-2 !text-red-400 hover:!bg-red-500/10">删除</button>
                  </div>
                </td>
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

    <!-- 添加管理员弹窗 -->
    <ClientOnly>
      <Teleport to="body">
        <div v-if="showAddAdmin" class="modal-backdrop" @click.self="showAddAdmin = false">
          <div class="modal-content">
            <div class="modal-header">
              <h3 class="text-base font-bold text-slate-100">添加管理员</h3>
              <button @click="showAddAdmin = false" class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500"><MorphIcon name="x" :size="16" class="pointer-events-none" /></button>
            </div>
            <div class="modal-body space-y-4">
              <div><label class="block text-xs text-slate-400 mb-2 uppercase">用户名</label><input v-model="newAdmin.username" type="text" placeholder="用户名" class="form-input" /></div>
              <div><label class="block text-xs text-slate-400 mb-2 uppercase">密码</label><input v-model="newAdmin.password" type="password" placeholder="密码" class="form-input" /></div>
              <div><label class="block text-xs text-slate-400 mb-2 uppercase">角色</label>
                <select v-model="newAdmin.role" class="form-input">
                  <option value="school_admin">学校管理员</option>
                  <option value="grade_admin">年级管理员</option>
                  <option value="class_admin">班级管理员</option>
                  <option value="super_admin">超级管理员</option>
                </select>
              </div>
              <div v-if="newAdmin.role !== 'super_admin'">
                <label class="block text-xs text-slate-400 mb-2 uppercase">学校</label>
                <select v-model="newAdmin.schoolId" class="form-input">
                  <option value="" disabled>请选择学校</option>
                  <option v-for="s in schools" :key="s.id" :value="s.id">{{ s.name }}</option>
                </select>
              </div>
              <div v-if="newAdmin.role === 'grade_admin' || newAdmin.role === 'class_admin'">
                <label class="block text-xs text-slate-400 mb-2 uppercase">年级</label>
                <select v-model="newAdmin.gradeId" class="form-input" :disabled="!newAdmin.schoolId">
                  <option value="" disabled>请选择年级</option>
                  <option v-for="g in addAdminGrades" :key="g.id" :value="g.id">{{ g.name }}</option>
                </select>
              </div>
              <div v-if="newAdmin.role === 'class_admin'">
                <label class="block text-xs text-slate-400 mb-2 uppercase">班级</label>
                <select v-model="newAdmin.classId" class="form-input" :disabled="!newAdmin.gradeId">
                  <option value="" disabled>请选择班级</option>
                  <option v-for="c in addAdminClasses" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>
              </div>
            </div>
            <div class="modal-footer"><button @click="showAddAdmin = false" class="btn btn-ghost">取消</button><button @click="createAdmin" class="btn btn-primary">创建</button></div>
          </div>
        </div>
      </Teleport>
    </ClientOnly>

    <!-- 删除管理员确认 -->
    <UiConfirm :show="!!confirmDeleteAdmin" danger title="删除管理员" :message="`确定删除管理员「${confirmDeleteAdmin?.username}」吗？此操作不可撤销`" @confirm="deleteAdmin(confirmDeleteAdmin!.id)" @cancel="confirmDeleteAdmin = null; confirmDeletePassword = ''">
      <template #extra>
        <div class="mt-3">
          <label class="block text-xs text-slate-400 mb-2 uppercase">确认密码</label>
          <input v-model="confirmDeletePassword" type="password" placeholder="请输入您的管理员密码" class="form-input" @keyup.enter="$emit('confirm')" />
        </div>
      </template>
    </UiConfirm>

    <!-- 封禁管理员确认 -->
    <UiConfirm
      :show="!!confirmToggleAdmin"
      :title="confirmToggleAdmin?.disabled === 1 ? '启用管理员' : '封禁管理员'"
      :message="confirmToggleAdmin ? `确定要${confirmToggleAdmin.disabled === 1 ? '启用' : '封禁'}管理员「${confirmToggleAdmin.username}」吗？` : ''"
      :danger="confirmToggleAdmin?.disabled !== 1"
      @confirm="confirmToggleAdminDisabled"
      @cancel="confirmToggleAdmin = null"
    />

    <!-- 管理员详情弹窗 -->
    <ClientOnly>
      <Teleport to="body">
        <div v-if="showDetail" class="modal-backdrop" @click.self="showDetail = false">
          <div class="modal-content max-w-md">
            <div class="modal-header">
              <h3 class="text-base font-bold text-slate-100">管理员详情</h3>
              <button @click="showDetail = false" class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500"><MorphIcon name="x" :size="16" class="pointer-events-none" /></button>
            </div>
            <div class="modal-body space-y-4">
              <!-- 基本信息 -->
              <div class="space-y-3">
                <div class="flex justify-between items-center">
                  <span class="text-xs text-slate-500 uppercase">用户名</span>
                  <span class="text-sm text-slate-200 font-medium">{{ detailAdmin?.username }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-xs text-slate-500 uppercase">角色</span>
                  <span class="text-sm text-slate-200">{{ { super_admin: '超级管理员', school_admin: '学校管理员', grade_admin: '年级管理员', class_admin: '班级管理员' }[detailAdmin?.role || ''] || detailAdmin?.role }}</span>
                </div>
                <div class="pt-1">
                  <div class="flex justify-between items-center mb-2">
                    <span class="text-xs text-slate-500 uppercase">所属管理范围</span>
                    <span class="text-xs text-slate-400">{{ detailAdmin ? schoolDisplay(detailAdmin) : '-' }}</span>
                  </div>
                  <div v-if="detailAdmin?.role === 'super_admin'" class="text-xs text-slate-400">系统级管理员，无所属范围</div>
                  <template v-else>
                    <div class="space-y-2">
                      <div>
                        <label class="block text-xs text-slate-500 mb-1">学校</label>
                        <select v-model="detailSchoolId" class="form-input text-sm">
                          <option value="" disabled>请选择学校</option>
                          <option v-for="s in schools" :key="s.id" :value="s.id">{{ s.name }}</option>
                        </select>
                      </div>
                      <div v-if="detailAdmin?.role === 'grade_admin' || detailAdmin?.role === 'class_admin'">
                        <label class="block text-xs text-slate-500 mb-1">年级</label>
                        <select v-model="detailGradeId" class="form-input text-sm" :disabled="!detailSchoolId">
                          <option value="" disabled>请选择年级</option>
                          <option v-for="g in detailGrades" :key="g.id" :value="g.id">{{ g.name }}</option>
                        </select>
                      </div>
                      <div v-if="detailAdmin?.role === 'class_admin'">
                        <label class="block text-xs text-slate-500 mb-1">班级</label>
                        <select v-model="detailClassId" class="form-input text-sm" :disabled="!detailGradeId">
                          <option value="" disabled>请选择班级</option>
                          <option v-for="c in detailClasses" :key="c.id" :value="c.id">{{ c.name }}</option>
                        </select>
                      </div>
                      <button @click="updateAffiliation" :disabled="detailAffLoading" class="btn btn-primary text-sm w-full">{{ detailAffLoading ? '保存中…' : '保存所属' }}</button>
                    </div>
                  </template>
                </div>
                <div class="flex justify-between items-center gap-2">
                  <span class="text-xs text-slate-500 uppercase shrink-0">邮箱</span>
                  <div class="flex items-center gap-1.5">
                    <input v-model="detailEmail" type="email" placeholder="未绑定" class="form-input text-sm w-44 py-1" />
                    <button @click="updateEmail" class="btn btn-ghost text-xs py-1 px-2 text-brand-400 hover:!bg-brand-500/10 shrink-0">保存</button>
                  </div>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-xs text-slate-500 uppercase">创建时间</span>
                  <span class="text-xs text-slate-500">{{ detailAdmin ? formatDate(detailAdmin.createdAt) : '-' }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-xs text-slate-500 uppercase">最后登录</span>
                  <span class="text-xs text-slate-500">{{ detailAdmin?.lastLogin ? formatDate(detailAdmin.lastLogin) : '从未' }}</span>
                </div>
              </div>
              <div class="border-t border-slate-700/50 pt-4">
                <p class="text-xs text-slate-400 uppercase mb-3">修改密码</p>
                <div class="space-y-3">
                  <div>
                    <label class="block text-xs text-slate-400 mb-1.5">新密码</label>
                    <input v-model="detailNewPassword" type="password" placeholder="至少6位" class="form-input text-sm" />
                  </div>
                  <div>
                    <label class="block text-xs text-slate-400 mb-1.5">确认密码</label>
                    <input v-model="detailConfirmPassword" type="password" placeholder="再次输入新密码" class="form-input text-sm" @keyup.enter="updatePassword" />
                  </div>
                  <button @click="updatePassword" :disabled="!detailNewPassword || detailLoading" class="btn btn-primary text-sm w-full">更新密码</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Teleport>
    </ClientOnly>
  </div>
</template>
