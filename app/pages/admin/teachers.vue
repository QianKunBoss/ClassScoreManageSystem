<script setup lang="ts">
import type { Admin } from '~/types'
import { formatDate } from '~/utils/format'

definePageMeta({ auth: true })

const toast = useToast()
const { data: authData } = useFetch('/api/auth/me', {
  credentials: 'include', server: false,
  default: () => ({ success: false, admin: null }),
})
const currentUser = computed(() => authData.value?.admin || null)

// 管理员列表
const admins = ref<Admin[]>([])
// 年级列表（用于添加管理员时选择）
const grades = ref<any[]>([])
// 班级列表（用于添加管理员时选择）
const classes = ref<any[]>([])

// 添加管理员弹窗
const showAddModal = ref(false)
const newAdmin = ref({ username: '', password: '', role: 'grade_admin', gradeId: '' as number | '', classId: '' as number | '' })
const addLoading = ref(false)

// 删除确认
const confirmDelete = ref<Admin | null>(null)
const confirmPassword = ref('')

// 详情弹窗
const showDetail = ref(false)
const detailAdmin = ref<Admin | null>(null)
const detailNewPassword = ref('')
const detailConfirmPassword = ref('')
const detailLoading = ref(false)

// 所属学校显示文本
function schoolDisplay(a: Admin): string {
  if (!a.schoolName) return '-'
  if (a.role === 'school_admin') return `${a.schoolName}-校级`
  if (a.role === 'grade_admin') return `${a.schoolName}-${a.gradeName || '年级'}`
  if (a.role === 'class_admin') return `${a.schoolName}-${a.className || '班级'}`
  return a.schoolName
}

// 加载管理员列表
async function loadAdmins() {
  try {
    const res = await $fetch<{ data: Admin[] }>('/api/admin/manage')
    admins.value = res.data || []
  } catch { toast.error('加载管理员失败') }
}

// 加载年级列表（学校管理员用）
async function loadGrades() {
  if (currentUser.value?.role !== 'school_admin') return
  try {
    const res = await $fetch<{ data: any[] }>(`/api/grades?schoolId=${currentUser.value.schoolId}`)
    grades.value = res.data || []
  } catch { grades.value = [] }
}

// 加载班级列表（学校管理员选年级后、年级管理员用）
async function loadClasses() {
  if (!newAdmin.value.gradeId) { classes.value = []; return }
  try {
    const query: any = { gradeId: newAdmin.value.gradeId }
    if (currentUser.value?.role === 'school_admin' && currentUser.value?.schoolId) {
      query.schoolId = currentUser.value.schoolId
    }
    const res = await $fetch<{ data: any[] }>('/api/classes', { query })
    classes.value = res.data || []
  } catch { classes.value = [] }
}

// 监听年级选择变化
watch(() => newAdmin.value.gradeId, () => {
  newAdmin.value.classId = ''
  if (newAdmin.value.role === 'class_admin') loadClasses()
})

// 监听角色变化
watch(() => newAdmin.value.role, () => {
  newAdmin.value.gradeId = ''
  newAdmin.value.classId = ''
  classes.value = []
  if (newAdmin.value.role === 'grade_admin' || newAdmin.value.role === 'class_admin') {
    loadGrades()
  }
})

// 打开添加弹窗
watch(showAddModal, (open) => {
  if (open) {
    newAdmin.value = { username: '', password: '', role: 'grade_admin', gradeId: '', classId: '' }
    grades.value = []
    classes.value = []
    if (currentUser.value?.role === 'school_admin') {
      loadGrades()
    }
  }
})

// 创建管理员
async function createAdmin() {
  if (!newAdmin.value.username || !newAdmin.value.password) {
    toast.error('请填写用户名和密码')
    return
  }
  if (newAdmin.value.role === 'class_admin' && !newAdmin.value.classId) {
    toast.error('请选择班级')
    return
  }
  if (newAdmin.value.role === 'grade_admin' && !newAdmin.value.gradeId) {
    toast.error('请选择年级')
    return
  }

  addLoading.value = true
  try {
    const body: any = {
      username: newAdmin.value.username,
      password: newAdmin.value.password,
      role: newAdmin.value.role,
    }
    if (newAdmin.value.gradeId) body.gradeId = newAdmin.value.gradeId
    if (newAdmin.value.classId) body.classId = newAdmin.value.classId

    await $fetch('/api/admin/manage', { method: 'POST', body })
    toast.success('管理员已创建')
    showAddModal.value = false
    await loadAdmins()
  } catch (err) {
    toast.error(err.data?.statusMessage || err.data?.message || '创建失败')
  } finally {
    addLoading.value = false
  }
}

// 打开详情
function openDetail(a: Admin) {
  detailAdmin.value = a
  detailNewPassword.value = ''
  detailConfirmPassword.value = ''
  showDetail.value = true
}

// 修改密码
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
  } catch (err) {
    toast.error(err.data?.statusMessage || err.data?.message || '更新失败')
  } finally {
    detailLoading.value = false
  }
}

// 删除管理员
async function deleteAdmin() {
  if (!confirmPassword.value) { toast.error('请输入确认密码'); return }
  try {
    await $fetch(`/api/admin/manage/${confirmDelete.value!.id}`, {
      method: 'DELETE',
      headers: { 'x-confirm-password': confirmPassword.value },
    })
    toast.success('管理员已删除')
    confirmDelete.value = null
    confirmPassword.value = ''
    await loadAdmins()
  } catch (err) {
    toast.error(err.data?.statusMessage || err.data?.message || '删除失败')
  }
}

// 初始加载
watchEffect(async () => {
  if (currentUser.value) {
    await loadAdmins()
  }
})
</script>

<template>
  <div>
    <!-- 页头 -->
    <section class="border-b border-slate-800/50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-slate-100 mb-1">老师管理</h1>
          <p class="text-sm text-slate-500">
            {{ currentUser?.role === 'school_admin' ? '管理本校的年级和班级管理员' : '管理本年级的班级管理员' }}
          </p>
        </div>
        <button
          v-if="currentUser?.role !== 'class_admin'"
          @click="showAddModal = true"
          class="btn btn-primary text-sm"
        >
          + 添加管理员
        </button>
      </div>
    </section>

    <!-- 管理员列表 -->
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="glass-card p-6 animate-slide-up">
        <div v-if="admins.length === 0" class="text-center py-12 text-sm text-slate-500">
          暂无下级管理员，点击右上角「+ 添加管理员」创建
        </div>
        <div v-else class="overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>用户名</th>
                <th>所属</th>
                <th>角色</th>
                <th>创建时间</th>
                <th>最后登录</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in admins" :key="a.id">
                <td><span class="text-sm font-medium text-slate-200">{{ a.username }}</span></td>
                <td class="text-xs text-slate-400">{{ schoolDisplay(a) }}</td>
                <td>
                  <span
                    :class="{
                      'text-xs px-2 py-0.5 rounded-full': true,
                      'bg-blue-500/10 text-blue-400': a.role === 'school_admin',
                      'bg-emerald-500/10 text-emerald-400': a.role === 'grade_admin',
                      'bg-purple-500/10 text-purple-400': a.role === 'class_admin',
                    }"
                  >
                    {{ { school_admin: '学校管理员', grade_admin: '年级管理员', class_admin: '班级管理员' }[a.role] || a.role }}
                  </span>
                </td>
                <td class="text-xs text-slate-500">{{ formatDate(a.createdAt) }}</td>
                <td class="text-xs text-slate-500">{{ a.lastLogin ? formatDate(a.lastLogin) : '从未' }}</td>
                <td>
                  <div class="flex items-center gap-1">
                    <button @click="openDetail(a)" class="btn btn-ghost text-xs py-1 px-2 text-sky-400 hover:!bg-sky-500/10">详情</button>
                    <button
                      v-if="a.id !== currentUser?.id"
                      @click="confirmDelete = a"
                      class="btn btn-ghost text-xs py-1 px-2 !text-red-400 hover:!bg-red-500/10"
                    >
                      删除
                    </button>
                  </div>
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
        <div v-if="showAddModal" class="modal-backdrop" @click.self="showAddModal = false">
          <div class="modal-content">
            <div class="modal-header">
              <h3 class="text-base font-bold text-slate-100">添加管理员</h3>
              <button @click="showAddModal = false" class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500">✕</button>
            </div>
            <div class="modal-body space-y-4">
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase">用户名</label>
                <input v-model="newAdmin.username" type="text" placeholder="请输入用户名" class="form-input" />
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase">密码</label>
                <input v-model="newAdmin.password" type="password" placeholder="请输入密码（至少6位）" class="form-input" />
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase">角色</label>
                <select v-model="newAdmin.role" class="form-input">
                  <option v-if="currentUser?.role === 'school_admin'" value="grade_admin">年级管理员</option>
                  <option v-if="currentUser?.role === 'school_admin'" value="class_admin">班级管理员</option>
                  <option v-if="currentUser?.role === 'grade_admin'" value="class_admin">班级管理员</option>
                </select>
              </div>
              <div v-if="newAdmin.role === 'grade_admin' || newAdmin.role === 'class_admin'">
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase">年级</label>
                <select v-model="newAdmin.gradeId" class="form-input" :disabled="grades.length === 0">
                  <option value="">请选择年级</option>
                  <option v-for="g in grades" :key="g.id" :value="g.id">{{ g.name }}</option>
                </select>
              </div>
              <div v-if="newAdmin.role === 'class_admin'">
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase">班级</label>
                <select v-model="newAdmin.classId" class="form-input" :disabled="!newAdmin.gradeId">
                  <option value="">请选择班级</option>
                  <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>
              </div>
            </div>
            <div class="modal-footer">
              <button @click="showAddModal = false" class="btn btn-ghost">取消</button>
              <button @click="createAdmin" :disabled="addLoading" class="btn btn-primary">
                {{ addLoading ? '创建中...' : '创建' }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </ClientOnly>

    <!-- 详情弹窗 -->
    <ClientOnly>
      <Teleport to="body">
        <div v-if="showDetail" class="modal-backdrop" @click.self="showDetail = false">
          <div class="modal-content max-w-md">
            <div class="modal-header">
              <h3 class="text-base font-bold text-slate-100">管理员详情</h3>
              <button @click="showDetail = false" class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500">✕</button>
            </div>
            <div class="modal-body space-y-4">
              <div class="space-y-3">
                <div class="flex justify-between items-center">
                  <span class="text-xs text-slate-500 uppercase">用户名</span>
                  <span class="text-sm text-slate-200 font-medium">{{ detailAdmin?.username }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-xs text-slate-500 uppercase">角色</span>
                  <span class="text-sm text-slate-200">
                    {{ { school_admin: '学校管理员', grade_admin: '年级管理员', class_admin: '班级管理员' }[detailAdmin?.role || ''] || detailAdmin?.role }}
                  </span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-xs text-slate-500 uppercase">所属</span>
                  <span class="text-sm text-slate-400">{{ detailAdmin ? schoolDisplay(detailAdmin) : '-' }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-xs text-slate-500 uppercase">创建时间</span>
                  <span class="text-xs text-slate-500">{{ detailAdmin ? formatDate(detailAdmin.createdAt) : '-' }}</span>
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

    <!-- 删除确认 -->
    <UiConfirm
      :show="!!confirmDelete"
      danger
      title="删除管理员"
      :message="`确定删除管理员「${confirmDelete?.username}」吗？此操作不可撤销`"
      @confirm="deleteAdmin"
      @cancel="confirmDelete = null; confirmPassword = ''"
    >
      <template #extra>
        <div class="mt-3">
          <label class="block text-xs text-slate-400 mb-2 uppercase">确认密码</label>
          <input v-model="confirmPassword" type="password" placeholder="请输入您的管理员密码" class="form-input text-sm" @keyup.enter="$emit('confirm')" />
        </div>
      </template>
    </UiConfirm>
  </div>
</template>
