<script setup lang="ts">
import type { Admin, Application, School, CreatedAccount } from '~/types'
import { formatDate } from '~/utils/format'

definePageMeta({ middleware: 'super-admin' })

const toast = useToast()
const { data: authData } = useFetch('/api/auth/me', {
  credentials: 'include', server: false, default: () => ({ success: false, admin: null }),
})
const currentUser = computed(() => authData.value?.admin || null)

// 申请审核
const applications = ref<Application[]>([])
const appFilter = ref<'all' | 'pending' | 'approved' | 'rejected'>('pending')
const reviewingApp = ref<Application | null>(null)
const reviewNote = ref('')
const reviewLoading = ref(false)
const createdAccount = ref<CreatedAccount | null>(null)

// 学校管理
const schools = ref<School[]>([])

async function loadSchools() {
  try {
    // 超级管理员需要看到所有学校（包括被封禁的）
    const res = await $fetch<{ data: School[] }>('/api/schools', {
      params: { includeDisabled: '1' }
    })
    schools.value = res.data
  } catch { toast.error('加载学校失败') }
}

async function toggleSchoolDisabled(school: any) {
  confirmToggleSchool.value = school
}

async function confirmToggleSchoolDisabled() {
  const school = confirmToggleSchool.value
  if (!school) return
  const newStatus = school.disabled === 1 ? 0 : 1
  try {
    await $fetch(`/api/schools/${school.id}`, {
      method: 'PATCH',
      body: { disabled: newStatus },
    })
    toast.success(`学校已${newStatus === 1 ? '封禁' : '启用'}`)
    confirmToggleSchool.value = null
    await loadSchools()
  } catch (err) {
    toast.error(err.data?.statusMessage || '操作失败')
  }
}

// 管理员管理
const admins = ref<Admin[]>([])
const filterSchoolId = ref<number | ''>('')
const showAddAdmin = ref(false)
const newAdmin = ref({ username: '', password: '', role: 'school_admin', schoolId: '' as number | '', gradeId: '' as number | '', classId: '' as number | '' })
const addAdminGrades = ref<any[]>([])
const addAdminClasses = ref<any[]>([])
const addAdminLoading = ref(false)
const confirmDeleteAdmin = ref<Admin | null>(null)
const confirmDeletePassword = ref('')

// 封禁确认
const confirmToggleSchool = ref<School | null>(null)
const confirmToggleAdmin = ref<Admin | null>(null)

// 详情弹窗
const showDetail = ref(false)
const detailAdmin = ref<Admin | null>(null)
const detailNewPassword = ref('')
const detailConfirmPassword = ref('')
const detailLoading = ref(false)

function openDetail(a: Admin) {
  detailAdmin.value = a
  detailNewPassword.value = ''
  detailConfirmPassword.value = ''
  showDetail.value = true
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
  } catch (err) { toast.error(err.data?.statusMessage || err.data?.message || '更新失败') }
  finally { detailLoading.value = false }
}

// 所属学校显示文本
function schoolDisplay(a: Admin): string {
  if (!a.schoolName) return '-'
  if (a.role === 'school_admin') return `${a.schoolName}-校级`
  if (a.role === 'grade_admin') return `${a.schoolName}-${a.gradeName || '年级'}`
  if (a.role === 'class_admin') return `${a.schoolName}-${a.className || '班级'}`
  return a.schoolName
}

// 筛选后的管理员列表
const filteredAdmins = computed(() => {
  if (!filterSchoolId.value) return admins.value
  return admins.value.filter(a => a.schoolId === filterSchoolId.value)
})

async function loadAdmins() {
  try {
    const res = await $fetch<{ data: Admin[] }>('/api/admin/manage')
    admins.value = res.data
  } catch { toast.error('加载管理员失败') }
}

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
  } catch (err) { toast.error(err.data?.statusMessage || err.data?.message || '创建失败') }
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
    toast.success('角色已更新')
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
    toast.error(err.data?.statusMessage || err.data?.message || '操作失败')
  }
}

// 申请审核
async function loadApplications() {
  try {
    const res = await $fetch<{ data: Application[] }>('/api/applications', {
      query: { status: appFilter.value === 'all' ? undefined : appFilter.value },
    })
    applications.value = res.data
  } catch { toast.error('加载申请失败') }
}

async function openReview(app: Application) {
  reviewingApp.value = app
  reviewNote.value = ''
}

async function submitReview(status: 'approved' | 'rejected') {
  if (!reviewingApp.value) return
  reviewLoading.value = true
  try {
    const res = await $fetch<{ account: CreatedAccount }>(`/api/applications/${reviewingApp.value.id}`, {
      method: 'PATCH',
      body: { status, reviewNote: reviewNote.value },
    })
    toast.success(status === 'approved' ? '已通过审核' : '已拒绝申请')
    
    if (status === 'approved' && res.account) {
      // 显示创建的账号信息
      createdAccount.value = res.account
    } else {
      reviewingApp.value = null
    }
    
    await Promise.all([loadApplications(), loadSchools()])
  } catch (err) { toast.error(err.data?.message || '操作失败') }
  finally { reviewLoading.value = false }
}

watchEffect(async () => {
  if (currentUser.value?.role === 'super_admin') {
    await Promise.all([loadAdmins(), loadApplications(), loadSchools()])
  }
})
</script>

<template>
  <div>
    <section class="border-b border-slate-800/50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h1 class="text-xl font-bold text-slate-100 mb-1">超级管理</h1>
        <p class="text-sm text-slate-500">系统全局配置、管理员账号管理</p>
      </div>
    </section>

    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <!-- 管理员管理 -->
      <div class="glass-card p-6 animate-slide-up">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-bold text-slate-100">管理员账号</h2>
          <div class="flex items-center gap-3">
            <select v-model="filterSchoolId" class="form-input text-sm py-1.5 w-48">
              <option :value="''">全部学校</option>
              <option v-for="s in schools" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
            <button @click="showAddAdmin = true" class="btn btn-primary text-sm">+ 添加</button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>用户名</th>
                <th>所属学校</th>
                <th>角色</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>最后登录</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in filteredAdmins" :key="a.id" :class="a.disabled === 1 ? 'opacity-60' : ''">
                <td><span class="text-sm font-medium text-slate-200">{{ a.username }}</span></td>
                <td class="text-xs text-slate-400">{{ schoolDisplay(a) }}</td>
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
                    <button @click="openDetail(a)" class="btn btn-ghost text-xs py-1 px-2 text-sky-400 hover:!bg-sky-500/10">详情</button>
                    <button v-if="a.id !== currentUser?.id" @click="confirmDeleteAdmin = a" class="btn btn-ghost text-xs py-1 px-2 !text-red-400 hover:!bg-red-500/10">删除</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 学校管理 -->
      <div class="glass-card p-6 animate-slide-up">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-bold text-slate-100">学校管理</h2>
          <span class="text-xs text-slate-500">共 {{ schools.length }} 所学校</span>
        </div>
        <div v-if="schools.length === 0" class="text-center py-8 text-sm text-slate-500">暂无学校，请先审核入驻申请</div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div v-for="s in schools" :key="s.id" class="flex items-center justify-between p-3 rounded-lg bg-slate-800/20 hover:bg-slate-800/40 transition-all" :class="s.disabled === 1 ? 'opacity-60' : ''">
            <div>
              <div class="text-sm font-medium text-slate-200">{{ s.name }}</div>
              <div class="text-xs text-slate-500 mt-0.5">ID: {{ s.id }} · {{ formatDate(s.createdAt) }}</div>
              <div v-if="s.disabled === 1" class="text-xs text-red-400 mt-0.5">🚫 已封禁</div>
            </div>
            <div class="flex items-center gap-2">
              <button 
                v-if="s.disabled !== 1" 
                @click="toggleSchoolDisabled(s)" 
                class="btn btn-ghost text-xs py-1 px-2 !text-red-400 hover:!bg-red-500/10"
              >
                封禁
              </button>
              <button 
                v-else 
                @click="toggleSchoolDisabled(s)" 
                class="btn btn-ghost text-xs py-1 px-2 !text-emerald-400 hover:!bg-emerald-500/10"
              >
                启用
              </button>
              <NuxtLink :to="`/superadmin/schools/${s.id}`" class="btn btn-primary text-xs py-1 px-3">
                管理
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 入驻申请审核 -->
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="glass-card p-6 animate-slide-up">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-bold text-slate-100">入驻申请</h2>
          <div class="flex items-center gap-2">
            <button @click="appFilter = 'pending'" :class="appFilter === 'pending' ? 'btn btn-primary text-xs' : 'btn btn-ghost text-xs'">待审核</button>
            <button @click="appFilter = 'approved'" :class="appFilter === 'approved' ? 'btn btn-primary text-xs' : 'btn btn-ghost text-xs'">已通过</button>
            <button @click="appFilter = 'rejected'" :class="appFilter === 'rejected' ? 'btn btn-primary text-xs' : 'btn btn-ghost text-xs'">已拒绝</button>
            <button @click="appFilter = 'all'" :class="appFilter === 'all' ? 'btn btn-primary text-xs' : 'btn btn-ghost text-xs'">全部</button>
          </div>
        </div>
        <div v-if="applications.length === 0" class="text-center py-8 text-sm text-slate-500">暂无申请</div>
        <div v-else class="overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>学校</th>
                <th>范围</th>
                <th>申请人</th>
                <th>联系</th>
                <th>状态</th>
                <th>申请时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="app in applications" :key="app.id">
                <td><span class="text-sm font-medium text-slate-200">{{ app.schoolName }}</span></td>
                <td class="text-xs text-slate-400">
                  {{ app.gradeName ? (app.className ? `年级·${app.gradeName} / 班级·${app.className}` : `年级·${app.gradeName}`) : '全校' }}
                </td>
                <td class="text-xs text-slate-300">{{ app.applicantName }}</td>
                <td class="text-xs text-slate-500 max-w-xs truncate">{{ app.contactPhone || app.contactEmail || '-' }}</td>
                <td>
                  <span v-if="app.status === 'pending'" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-yellow-500/10 text-yellow-400">待审核</span>
                  <span v-else-if="app.status === 'approved'" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-500/10 text-emerald-400">已通过</span>
                  <span v-else class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-500/10 text-red-400">已拒绝</span>
                </td>
                <td class="text-xs text-slate-500">{{ formatDate(app.createdAt) }}</td>
                <td>
                  <button v-if="app.status === 'pending'" @click="openReview(app)" class="btn btn-primary text-xs py-1 px-3">审核</button>
                  <span v-else class="text-xs text-slate-500">{{ app.reviewNote || '-' }}</span>
                </td>
              </tr>
            </tbody>
          </table>
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
              <button @click="showAddAdmin = false" class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500">✕</button>
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

    <!-- 封禁学校确认 -->
    <UiConfirm
      :show="!!confirmToggleSchool"
      :title="confirmToggleSchool?.disabled === 1 ? '启用学校' : '封禁学校'"
      :message="confirmToggleSchool ? `确定要${confirmToggleSchool.disabled === 1 ? '启用' : '封禁'}学校「${confirmToggleSchool.name}」吗？` : ''"
      :danger="confirmToggleSchool?.disabled !== 1"
      @confirm="confirmToggleSchoolDisabled"
      @cancel="confirmToggleSchool = null"
    />

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
              <button @click="showDetail = false" class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500">✕</button>
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
                <div class="flex justify-between items-center">
                  <span class="text-xs text-slate-500 uppercase">所属</span>
                  <span class="text-sm text-slate-400">{{ detailAdmin ? schoolDisplay(detailAdmin) : '-' }}</span>
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

    <!-- 审核申请弹窗 -->
    <ClientOnly>
      <Teleport to="body">
        <!-- 审核表单 -->
        <div v-if="reviewingApp && !createdAccount" class="modal-backdrop" @click.self="reviewingApp = null">
          <div class="modal-content max-w-lg">
            <div class="modal-header">
              <h3 class="text-base font-bold text-slate-100">审核申请</h3>
              <button @click="reviewingApp = null" class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500">✕</button>
            </div>
            <div class="modal-body space-y-4">
              <div><span class="text-xs text-slate-400">学校：</span><span class="text-sm text-slate-200">{{ reviewingApp.schoolName }}</span></div>
              <div v-if="reviewingApp.gradeName"><span class="text-xs text-slate-400">年级：</span><span class="text-sm text-slate-200">{{ reviewingApp.gradeName }}</span></div>
              <div v-if="reviewingApp.className"><span class="text-xs text-slate-400">班级：</span><span class="text-sm text-slate-200">{{ reviewingApp.className }}</span></div>
              <div><span class="text-xs text-slate-400">申请人：</span><span class="text-sm text-slate-200">{{ reviewingApp.applicantName }}</span></div>
              <div v-if="reviewingApp.contactPhone || reviewingApp.contactEmail">
                <span class="text-xs text-slate-400">联系：</span>
                <span class="text-sm text-slate-200">{{ reviewingApp.contactPhone }} {{ reviewingApp.contactEmail }}</span>
              </div>
              <div v-if="reviewingApp.reason"><span class="text-xs text-slate-400">理由：</span><p class="text-sm text-slate-300 mt-1">{{ reviewingApp.reason }}</p></div>
              <div>
                <label class="block text-xs text-slate-400 mb-2 uppercase">审核备注</label>
                <textarea v-model="reviewNote" placeholder="可选，填写审核意见" rows="2" class="form-input resize-none text-sm"></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button @click="reviewingApp = null" class="btn btn-ghost">取消</button>
              <button @click="submitReview('rejected')" :disabled="reviewLoading" class="btn bg-red-500/20 text-red-400 hover:bg-red-500/30 text-sm px-4 py-2">拒绝</button>
              <button @click="submitReview('approved')" :disabled="reviewLoading" class="btn btn-primary text-sm px-4 py-2">通过</button>
            </div>
          </div>
        </div>
        <!-- 审核通过 - 显示账号信息 -->
        <div v-else-if="createdAccount" class="modal-backdrop" @click.self="createdAccount = null; reviewingApp = null">
          <div class="modal-content max-w-lg">
            <div class="modal-header">
              <h3 class="text-base font-bold text-emerald-400">✅ 审核通过，账号已创建</h3>
              <button @click="createdAccount = null; reviewingApp = null" class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500">✕</button>
            </div>
            <div class="modal-body space-y-4">
              <div class="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <p class="text-sm text-emerald-300 mb-3">请将这些信息发送给申请人，让其登录系统：</p>
                <div class="space-y-2 text-sm">
                  <div class="flex justify-between"><span class="text-slate-400">登录地址：</span><code class="text-slate-200 bg-slate-800/50 px-2 py-0.5 rounded">（当前系统地址）</code></div>
                  <div class="flex justify-between"><span class="text-slate-400">用户名：</span><code class="text-emerald-300 bg-slate-800/50 px-2 py-0.5 rounded">{{ createdAccount.username }}</code></div>
                  <div class="flex justify-between"><span class="text-slate-400">密码：</span><code class="text-emerald-300 bg-slate-800/50 px-2 py-0.5 rounded">{{ createdAccount.password }}</code></div>
                  <div class="flex justify-between"><span class="text-slate-400">角色：</span><span class="text-slate-200">{{ createdAccount.role === 'school_admin' ? '学校管理员' : createdAccount.role === 'grade_admin' ? '年级管理员' : '班级管理员' }}</span></div>
                  <div class="flex justify-between"><span class="text-slate-400">管辖：</span><span class="text-slate-200">{{ createdAccount.school }}{{ createdAccount.grade ? ' / ' + createdAccount.grade : '' }}{{ createdAccount.class ? ' / ' + createdAccount.class : '' }}</span></div>
                </div>
              </div>
              <p class="text-xs text-slate-500">⚠️ 请提醒申请人登录后立即修改密码</p>
            </div>
            <div class="modal-footer">
              <button @click="createdAccount = null; reviewingApp = null" class="btn btn-primary text-sm px-4 py-2">我知道了</button>
            </div>
          </div>
        </div>
      </Teleport>
    </ClientOnly>

  </div>
</template>

