<script setup lang="ts">
import type { User, PaginatedResponse } from '~/types'

definePageMeta({ auth: true })

const { data: authData } = useFetch('/api/auth/me', {
  credentials: 'include',
  server: false,
  default: () => ({ success: false, admin: null }),
})
const toast = useToast()
const currentUser = computed(() => authData.value?.admin || null)

const users = ref<User[]>([])
const loading = ref(true)
const showAddModal = ref(false)
const showBatchModal = ref(false)
const showDeleteConfirm = ref(false)
const userToDelete = ref<User | null>(null)
const deletePassword = ref('')
const newUser = ref({ username: '', password: '' })
const addUserClassId = ref<number | ''>('')
const batchInput = ref('')
const batchClassId = ref<number | ''>('')
const batchLoading = ref(false)
const batchResult = ref<{ success: number, failed: number, errors: string[] } | null>(null)
const schools = ref<any[]>([])  // 学校列表（超级管理员用）
const filterSchoolId = ref<number | null>(null)  // 学校筛选
const classes = ref<any[]>([])  // 班级列表（用于批量添加时选择班级）

watchEffect(async () => {
  if (!currentUser.value) return

  // 超级管理员加载学校列表
  if (currentUser.value?.role === 'super_admin' && schools.value.length === 0) {
    try {
      const res = await $fetch<{ success: boolean, data: any[] }>('/api/schools')
      schools.value = res.data || []
    } catch {
      console.error('加载学校列表失败')
    }
  }

  try {
    const query: any = {}
    if (currentUser.value?.role === 'super_admin' && filterSchoolId.value) {
      query.schoolId = filterSchoolId.value
    }
    const res = await $fetch<PaginatedResponse<User>>('/api/users', { query })
    users.value = res.data
  } catch (err) {
    console.error('加载用户失败', err)
  } finally {
    loading.value = false
  }
})

// 加载班级列表（用于批量添加）
async function loadClasses() {
  classes.value = []
  try {
    const query: any = {}
    // 超级管理员必须指定学校
    if (currentUser.value?.role === 'super_admin') {
      if (!filterSchoolId.value) {
        return  // 未选学校，不加载班级
      }
      query.schoolId = filterSchoolId.value
    }
    const res = await $fetch<{ success: boolean, data: any[] }>('/api/classes', { query })
    classes.value = res.data || []
  } catch {
    console.error('加载班级列表失败')
  }
}

// 单个添加时加载班级列表
async function loadAddUserClasses() {
  try {
    const query: any = {}
    if (currentUser.value?.role === 'super_admin') {
      if (!filterSchoolId.value) { classes.value = []; return }
      query.schoolId = filterSchoolId.value
    }
    const res = await $fetch<{ success: boolean, data: any[] }>('/api/classes', { query })
    classes.value = res.data || []
    // 自动选中第一个（如果只有一个班级）
    if (res.data && res.data.length === 1) {
      addUserClassId.value = res.data[0].id
    }
  } catch { classes.value = [] }
}

watch(showAddModal, (open) => {
  if (open) {
    newUser.value = { username: '', password: '' }
    addUserClassId.value = ''
    loadAddUserClasses()
  }
})

async function addUser() {
  if (!newUser.value.username || !newUser.value.password) {
    toast.error('请填写用户名和密码')
    return
  }
  // 超级管理员必须选班级
  if (currentUser.value?.role === 'super_admin' && !addUserClassId.value) {
    toast.error('请选择班级')
    return
  }
  try {
    const body: any = { username: newUser.value.username, password: newUser.value.password }
    if (addUserClassId.value) body.classId = addUserClassId.value
    await $fetch('/api/users', {
      method: 'POST',
      body,
    })
    showAddModal.value = false
    newUser.value = { username: '', password: '' }
    const res = await $fetch<PaginatedResponse<User>>('/api/users')
    users.value = res.data
    toast.success('用户已创建')
  } catch (err) { toast.error(err.data?.message || '添加失败') }
}

async function batchAddUsers() {
  if (!batchInput.value.trim()) {
    toast.error('请输入用户名列表')
    return
  }
  if (!batchClassId.value) {
    toast.error('请选择班级')
    return
  }
  const lines = batchInput.value.split('\n').map(l => l.trim()).filter(Boolean)
  const batchUsers = lines.map(line => {
    // 支持格式：用户名 或 用户名,真实姓名
    const commaIdx = line.indexOf(',')
    if (commaIdx > 0) {
      return {
        username: line.slice(0, commaIdx).trim(),
        actualName: line.slice(commaIdx + 1).trim() || null,
        classId: batchClassId.value as number,
      }
    }
    return {
      username: line,
      actualName: null,
      classId: batchClassId.value as number,
    }
  })

  batchLoading.value = true
  batchResult.value = null
  try {
    const res: any = await $fetch('/api/users', {
      method: 'POST',
      body: { batch: batchUsers, defaultPassword: '123456' },
    })
    batchResult.value = res.results
    // 重新加载用户列表
    const query: any = {}
    if (currentUser.value?.role === 'super_admin' && filterSchoolId.value) {
      query.schoolId = filterSchoolId.value
    }
    const refreshRes = await $fetch<PaginatedResponse<User>>('/api/users', { query })
    users.value = refreshRes.data
    toast.success(res.message)
  } catch (err) {
    toast.error(err.data?.message || '批量添加失败')
  } finally {
    batchLoading.value = false
  }
}

function confirmDelete(user: User) {
  userToDelete.value = user
  showDeleteConfirm.value = true
}

async function deleteUser() {
  if (!userToDelete.value) return
  try {
    const query: any = {}
    if (currentUser.value?.role === 'super_admin' && filterSchoolId.value) {
      query.schoolId = filterSchoolId.value
    }
    await $fetch(`/api/users/${userToDelete.value.id}`, {
      method: 'DELETE',
      body: { password: deletePassword.value },
      query,
    })
    showDeleteConfirm.value = false
    userToDelete.value = null
    deletePassword.value = ''
    const res = await $fetch<PaginatedResponse<User>>('/api/users', {
      query: currentUser.value?.role === 'super_admin' && filterSchoolId.value
        ? { schoolId: filterSchoolId.value }
        : {}
    })
    users.value = res.data
    toast.success('用户已删除')
  } catch (err) { toast.error(err.data?.message || '删除失败') }
}
</script>

<template>
  <div>
    <!-- 页面标题栏 -->
    <section class="border-b border-slate-800/50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-xl font-bold text-slate-100 mb-1">学生管理</h1>
            <p class="text-sm text-slate-500">管理本班的学生账号</p>
          </div>
          <div class="flex items-center gap-3">
            <!-- 学校筛选（仅超级管理员显示） -->
            <select
              v-if="currentUser?.role === 'super_admin'"
              v-model="filterSchoolId"
              class="form-input text-sm py-1.5 w-48"
            >
              <option :value="null">所有学校</option>
              <option v-for="s in schools" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
            <button @click="showBatchModal = true; loadClasses(); batchResult = null" class="btn btn-ghost">批量添加</button>
            <button @click="showAddModal = true" class="btn btn-primary">+ 添加学生</button>
          </div>
        </div>
      </div>
    </section>

    <!-- 学生列表 -->
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="glass-card p-6 animate-slide-up">
        <!-- 加载骨架屏 -->
        <div v-if="loading" class="space-y-3">
          <div v-for="i in 5" :key="i" class="flex items-center gap-4 p-4 animate-pulse">
            <div class="w-10 h-10 rounded-lg bg-slate-800"></div>
            <div class="flex-1">
              <div class="w-28 h-3 rounded bg-slate-800 mb-2"></div>
              <div class="w-16 h-2 rounded bg-slate-800/50"></div>
            </div>
          </div>
        </div>

        <!-- 数据表格 -->
        <div v-else-if="users.length > 0" class="overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>学生</th>
                <th>所属班级</th>
                <th>积分</th>
                <th>加分</th>
                <th>扣分</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in users" :key="u.id">
                <td>
                  <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center font-bold text-indigo-400 text-sm">
                      {{ u.username.charAt(0).toUpperCase() }}
                    </div>
                    <div>
                      <p class="text-sm font-medium text-slate-200">{{ u.username }}</p>
                      <p class="text-xs text-slate-600">{{ u.scoreCount }} 次操作</p>
                    </div>
                  </div>
                </td>
                <td class="text-xs text-slate-400">
                  {{ u.gradeName ? u.gradeName + ' - ' : '' }}{{ u.className || '-' }}
                </td>
                <td>
                  <span class="text-sm font-bold text-indigo-400">{{ u.totalScore }}</span>
                </td>
                <td>
                  <span class="text-sm text-green-400">+{{ u.addScore }}</span>
                </td>
                <td>
                  <span class="text-sm text-red-400">{{ u.deductScore }}</span>
                </td>
                <td>
                  <div class="flex items-center gap-2">
                    <NuxtLink :to="`/users/${u.id}`" class="btn btn-ghost text-xs py-1 px-2">
                      查看
                    </NuxtLink>
                    <button
                      @click="confirmDelete(u)"
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

        <!-- 空状态 -->
        <div v-else class="text-center py-12 text-slate-600 text-sm">
          暂无学生数据，点击右上角「+ 添加学生」创建第一个账号
        </div>
      </div>
    </section>

    <!-- 添加学生模态框 -->
    <ClientOnly>
      <Teleport to="body">
        <div v-if="showAddModal" class="modal-backdrop" @click.self="showAddModal = false">
          <div class="modal-content">
            <div class="modal-header">
              <h3 class="text-base font-bold text-slate-100">添加新学生</h3>
              <button @click="showAddModal = false" class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500">✕</button>
            </div>
            <div class="modal-body space-y-4">
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase">用户名</label>
                <input v-model="newUser.username" type="text" placeholder="请输入用户名" class="form-input" />
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase">密码</label>
                <input v-model="newUser.password" type="password" placeholder="请输入密码" class="form-input" />
              </div>
              <div v-if="currentUser?.role !== 'class_admin'">
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase">所属班级</label>
                <select v-model="addUserClassId" class="form-input">
                  <option :value="''">请选择班级</option>
                  <option v-for="c in classes" :key="c.id" :value="c.id">
                    {{ c.gradeName ? c.gradeName + ' / ' : '' }}{{ c.name }}
                  </option>
                </select>
              </div>
              <div v-else>
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase">所属班级</label>
                <div class="form-input !bg-slate-800/30 !cursor-default text-slate-400">
                  {{ currentUser?.className || '未设置' }}
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button @click="showAddModal = false" class="btn btn-ghost">取消</button>
              <button @click="addUser" class="btn btn-primary">添加</button>
            </div>
          </div>
        </div>
      </Teleport>
    </ClientOnly>

    <!-- 批量添加模态框 -->
    <ClientOnly>
      <Teleport to="body">
        <div v-if="showBatchModal" class="modal-backdrop" @click.self="showBatchModal = false; batchResult = null; batchInput = ''">
          <div class="modal-content max-w-lg">
            <div class="modal-header">
              <h3 class="text-base font-bold text-slate-100">批量添加学生</h3>
              <button @click="showBatchModal = false; batchResult = null; batchInput = ''" class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500">✕</button>
            </div>
            <div class="modal-body space-y-4">
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase">选择班级</label>
                <select v-model="batchClassId" class="form-input">
                  <option :value="''">请选择班级</option>
                  <option v-for="c in classes" :key="c.id" :value="c.id">
                    {{ c.gradeName || '未命名年级' }} - {{ c.name }}
                  </option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase">用户名列表（一行一个）</label>
                <textarea
                  v-model="batchInput"
                  rows="8"
                  placeholder="用户名1&#10;用户名2, 张三&#10;用户名3, 李四"
                  class="form-input font-mono text-sm"
                ></textarea>
                <p class="text-xs text-slate-500 mt-1">格式：每行一个用户名，可用英文逗号分隔用户名和真实姓名，默认密码均为 123456</p>
              </div>
            </div>
            <div class="modal-footer flex-col items-stretch">
              <div v-if="batchResult" class="text-xs mb-3 w-full">
                <div class="flex gap-4 mb-2">
                  <span class="text-green-400">成功 {{ batchResult.success }} 个</span>
                  <span v-if="batchResult.failed > 0" class="text-red-400">失败 {{ batchResult.failed }} 个</span>
                </div>
                <div v-if="batchResult.errors.length > 0" class="max-h-24 overflow-y-auto text-red-400/80 bg-red-500/5 rounded p-2">
                  <div v-for="(err, i) in batchResult.errors" :key="i">{{ err }}</div>
                </div>
              </div>
              <div class="flex gap-2 w-full">
                <button @click="showBatchModal = false; batchResult = null; batchInput = ''" class="btn btn-ghost flex-1">取消</button>
                <button @click="batchAddUsers" :disabled="batchLoading" class="btn btn-primary flex-1">
                  {{ batchLoading ? '添加中...' : '添加' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Teleport>
    </ClientOnly>

    <!-- 删除确认 -->
    <UiConfirm
      :show="showDeleteConfirm"
      danger
      title="确认删除"
      :message="`确定删除学生「${userToDelete?.username}」吗？此操作不可撤销`"
      @confirm="deleteUser"
      @cancel="showDeleteConfirm = false"
    >
      <template #extra>
        <div class="mt-3">
          <input v-model="deletePassword" type="password" placeholder="输入管理员密码确认" class="form-input text-sm" />
        </div>
      </template>
    </UiConfirm>
  </div>
</template>

