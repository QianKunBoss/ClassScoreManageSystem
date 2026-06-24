<script setup lang="ts">
import type { School, Grade, Class, User } from '~/types'
import { formatDate } from '~/utils/format'

definePageMeta({ middleware: 'super-admin' })

const route = useRoute()
const toast = useToast()
const schoolId = computed(() => Number(route.params.id))

// 学校信息
const school = ref<School | null>(null)
const loading = ref(true)

// 当前 Tab
const activeTab = ref<'grades' | 'classes' | 'users'>('grades')

// 年级管理
const grades = ref<Grade[]>([])
const showAddGrade = ref(false)
const newGradeName = ref('')
const addGradeLoading = ref(false)

// 班级管理
const classes = ref<Class[]>([])
const allClasses = ref<Class[]>([]) // 用户 Tab 用：全部班级
const filterGradeId = ref<number | ''>('')
const showAddClass = ref(false)
const newClassName = ref('')
const addClassLoading = ref(false)

// 用户管理
const users = ref<User[]>([])
const showAddUser = ref(false)
const showBatchAddUser = ref(false)
const newUser = ref({ username: '', classId: '' as number | '' })
const batchUsernames = ref('')
const batchClassId = ref<number | ''>('')
const addUserLoading = ref(false)
const batchAddLoading = ref(false)

// 删除确认
const confirmDeleteGrade = ref<Grade | null>(null)
const confirmDeleteClass = ref<Class | null>(null)
const confirmDeleteUser = ref<User | null>(null)
const confirmPassword = ref('')

// 加载学校信息
async function loadSchool() {
  loading.value = true
  try {
    const res = await $fetch<{ data: School }>(`/api/schools/${schoolId.value}`)
    school.value = res.data
  } catch {
    toast.error('加载学校信息失败')
    school.value = null
  } finally {
    loading.value = false
  }
}

// 加载年级
async function loadGrades() {
  try {
    const res = await $fetch<{ data: Grade[] }>('/api/grades', {
      query: { schoolId: schoolId.value },
    })
    grades.value = res.data || []
  } catch { toast.error('加载年级失败') }
}

// 加载班级（带年级筛选）
async function loadClasses() {
  try {
    const query: Record<string, any> = { schoolId: schoolId.value }
    if (filterGradeId.value) query.gradeId = filterGradeId.value
    const res = await $fetch<{ data: Class[] }>('/api/classes', { query })
    classes.value = res.data || []
  } catch { toast.error('加载班级失败') }
}

// 加载全部班级（用户 Tab 用）
async function loadAllClasses() {
  try {
    const res = await $fetch<{ data: Class[] }>('/api/classes', {
      query: { schoolId: schoolId.value },
    })
    allClasses.value = res.data || []
  } catch { toast.error('加载班级失败') }
}

// 加载用户
async function loadUsers() {
  try {
    const res = await $fetch<{ data: User[] }>('/api/users', {
      query: { schoolId: schoolId.value },
    })
    users.value = res.data || []
  } catch { toast.error('加载用户失败') }
}

// 添加年级
async function addGrade() {
  if (!newGradeName.value) { toast.error('请输入年级名称'); return }
  addGradeLoading.value = true
  try {
    await $fetch('/api/grades', {
      method: 'POST',
      body: { name: newGradeName.value },
      query: { schoolId: schoolId.value },
    })
    toast.success('年级已添加')
    showAddGrade.value = false
    newGradeName.value = ''
    await loadGrades()
  } catch (err) { toast.error((err as any).data?.message || '添加失败') }
  finally { addGradeLoading.value = false }
}

// 添加班级
async function addClass() {
  if (!newClassName.value || !filterGradeId.value) { toast.error('请输入班级名称并选择年级'); return }
  addClassLoading.value = true
  try {
    await $fetch('/api/classes', {
      method: 'POST',
      body: { name: newClassName.value, gradeId: filterGradeId.value },
      query: { schoolId: schoolId.value },
    })
    toast.success('班级已添加')
    showAddClass.value = false
    newClassName.value = ''
    await loadClasses()
    await loadAllClasses()
  } catch (err) { toast.error((err as any).data?.message || '添加失败') }
  finally { addClassLoading.value = false }
}

// 添加用户
async function addUser() {
  if (!newUser.value.username) { toast.error('请输入用户名'); return }
  if (!newUser.value.classId) { toast.error('请选择班级'); return }
  addUserLoading.value = true
  try {
    await $fetch('/api/users', {
      method: 'POST',
      body: {
        username: newUser.value.username,
        password: '123456',
        classId: newUser.value.classId,
      },
      query: { schoolId: schoolId.value },
    })
    toast.success('用户已添加，默认密码：123456')
    showAddUser.value = false
    newUser.value = { username: '', classId: '' }
    await loadUsers()
  } catch (err) { toast.error((err as any).data?.message || '添加失败') }
  finally { addUserLoading.value = false }
}

// 批量添加用户
async function batchAddUsers() {
  const names = batchUsernames.value.split('\n').map(n => n.trim()).filter(n => n)
  if (names.length === 0) { toast.error('请输入至少一个用户名'); return }
  if (!batchClassId.value) { toast.error('请选择班级'); return }
  batchAddLoading.value = true
  try {
    await $fetch('/api/users', {
      method: 'POST',
      body: {
        batch: names.map(n => ({ username: n, classId: batchClassId.value })),
        defaultPassword: '123456',
      },
      query: { schoolId: schoolId.value },
    })
    toast.success(`已批量添加 ${names.length} 个用户，默认密码：123456`)
    showBatchAddUser.value = false
    batchUsernames.value = ''
    batchClassId.value = ''
    await loadUsers()
  } catch (err) { toast.error((err as any).data?.message || '批量添加失败') }
  finally { batchAddLoading.value = false }
}

// 删除年级
async function deleteGrade() {
  if (!confirmDeleteGrade.value || !confirmPassword.value) { toast.error('请输入确认密码'); return }
  try {
    await $fetch(`/api/grades/${confirmDeleteGrade.value.id}`, {
      method: 'DELETE',
      headers: { 'x-confirm-password': confirmPassword.value },
      query: { schoolId: schoolId.value },
    })
    toast.success('年级已删除')
    confirmDeleteGrade.value = null
    confirmPassword.value = ''
    await loadGrades()
  } catch (err) { toast.error((err as any).data?.message || '删除失败') }
}

// 删除班级
async function deleteClass() {
  if (!confirmDeleteClass.value || !confirmPassword.value) { toast.error('请输入确认密码'); return }
  try {
    await $fetch(`/api/classes/${confirmDeleteClass.value.id}`, {
      method: 'DELETE',
      headers: { 'x-confirm-password': confirmPassword.value },
      query: { schoolId: schoolId.value },
    })
    toast.success('班级已删除')
    confirmDeleteClass.value = null
    confirmPassword.value = ''
    await loadClasses()
    await loadAllClasses()
  } catch (err) { toast.error((err as any).data?.message || '删除失败') }
}

// 删除用户
async function deleteUser() {
  if (!confirmDeleteUser.value || !confirmPassword.value) { toast.error('请输入确认密码'); return }
  try {
    await $fetch(`/api/users/${confirmDeleteUser.value.id}`, {
      method: 'DELETE',
      headers: { 'x-confirm-password': confirmPassword.value },
      query: { schoolId: schoolId.value },
    })
    toast.success('用户已删除')
    confirmDeleteUser.value = null
    confirmPassword.value = ''
    await loadUsers()
  } catch (err) { toast.error((err as any).data?.message || '删除失败') }
}

// Tab 切换
watch(activeTab, (tab) => {
  if (tab === 'grades') loadGrades()
  else if (tab === 'classes') { filterGradeId.value = ''; loadClasses() }
  else if (tab === 'users') { loadUsers(); loadAllClasses() }
})

// 年级筛选变化
watch(filterGradeId, () => {
  if (activeTab.value === 'classes') loadClasses()
})

onMounted(async () => {
  await loadSchool()
  await loadGrades()
})
</script>

<template>
  <div>
    <!-- 顶部 -->
    <section class="border-b border-slate-800/50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center gap-4">
        <NuxtLink to="/superadmin" class="btn btn-ghost text-sm">
          ← 返回
        </NuxtLink>
        <div>
          <h1 class="text-xl font-bold text-slate-100 mb-1">{{ school?.name || '加载中...' }}</h1>
          <p class="text-sm text-slate-500">学校ID: {{ schoolId }} · 创建于 {{ school ? formatDate(school.createdAt) : '-' }}</p>
        </div>
      </div>
    </section>

    <!-- Tab 导航 -->
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <div class="flex gap-2 mb-6">
        <button @click="activeTab = 'grades'" :class="activeTab === 'grades' ? 'btn btn-primary text-sm' : 'btn btn-ghost text-sm'">年级管理</button>
        <button @click="activeTab = 'classes'" :class="activeTab === 'classes' ? 'btn btn-primary text-sm' : 'btn btn-ghost text-sm'">班级管理</button>
        <button @click="activeTab = 'users'" :class="activeTab === 'users' ? 'btn btn-primary text-sm' : 'btn btn-ghost text-sm'">用户管理</button>
      </div>

      <!-- 年级管理 -->
      <div v-if="activeTab === 'grades'" class="glass-card p-6 animate-slide-up">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-bold text-slate-100">年级列表</h2>
          <button @click="showAddGrade = true" class="btn btn-primary text-sm">+ 添加年级</button>
        </div>
        <div v-if="grades.length === 0" class="text-center py-8 text-sm text-slate-500">暂无年级，请先添加</div>
        <div v-else class="overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>年级名称</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="g in grades" :key="g.id">
                <td class="text-sm text-slate-400">{{ g.id }}</td>
                <td class="text-sm font-medium text-slate-200">{{ g.name }}</td>
                <td class="text-xs text-slate-500">{{ formatDate(g.createdAt) }}</td>
                <td>
                  <button @click="confirmDeleteGrade = g; confirmPassword = ''" class="btn btn-ghost text-xs py-1 px-2 !text-red-400 hover:!bg-red-500/10">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 班级管理 -->
      <div v-if="activeTab === 'classes'" class="glass-card p-6 animate-slide-up">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <h2 class="text-sm font-bold text-slate-100">班级列表</h2>
            <select v-model="filterGradeId" class="form-input text-sm py-1.5 w-40">
              <option :value="''">全部年级</option>
              <option v-for="g in grades" :key="g.id" :value="g.id">{{ g.name }}</option>
            </select>
          </div>
          <button @click="showAddClass = true" :disabled="grades.length === 0" class="btn btn-primary text-sm">+ 添加班级</button>
        </div>
        <div v-if="classes.length === 0" class="text-center py-8 text-sm text-slate-500">{{ grades.length === 0 ? '请先添加年级' : '暂无班级，请先添加' }}</div>
        <div v-else class="overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>班级名称</th>
                <th>所属年级</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in classes" :key="c.id">
                <td class="text-sm text-slate-400">{{ c.id }}</td>
                <td class="text-sm font-medium text-slate-200">{{ c.name }}</td>
                <td class="text-xs text-slate-400">{{ c.gradeName || '-' }}</td>
                <td class="text-xs text-slate-500">{{ formatDate(c.createdAt) }}</td>
                <td>
                  <button @click="confirmDeleteClass = c; confirmPassword = ''" class="btn btn-ghost text-xs py-1 px-2 !text-red-400 hover:!bg-red-500/10">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 用户管理 -->
      <div v-if="activeTab === 'users'" class="glass-card p-6 animate-slide-up">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-bold text-slate-100">用户列表</h2>
          <div class="flex items-center gap-2">
            <button @click="showBatchAddUser = true" class="btn btn-ghost text-sm">批量添加</button>
            <button @click="showAddUser = true" class="btn btn-primary text-sm">+ 添加用户</button>
          </div>
        </div>
        <div v-if="users.length === 0" class="text-center py-8 text-sm text-slate-500">暂无用户，请先添加</div>
        <div v-else class="overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>用户名</th>
                <th>所属班级</th>
                <th>总积分</th>
                <th>加分</th>
                <th>扣分</th>
                <th>加分次数</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in users" :key="u.id">
                <td class="text-sm text-slate-400">{{ u.id }}</td>
                <td class="text-sm font-medium text-slate-200">{{ u.username }}</td>
                <td class="text-xs text-slate-400">{{ u.className || '-' }}</td>
                <td class="text-sm text-emerald-400">{{ u.totalScore }}</td>
                <td class="text-xs text-slate-400">{{ u.addScore || 0 }}</td>
                <td class="text-xs text-slate-400">{{ u.deductScore || 0 }}</td>
                <td class="text-xs text-slate-500">{{ u.scoreCount || 0 }}</td>
                <td class="text-xs text-slate-500">{{ formatDate(u.createdAt) }}</td>
                <td>
                  <button @click="confirmDeleteUser = u; confirmPassword = ''" class="btn btn-ghost text-xs py-1 px-2 !text-red-400 hover:!bg-red-500/10">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- 添加年级弹窗 -->
    <ClientOnly>
      <Teleport to="body">
        <div v-if="showAddGrade" class="modal-backdrop" @click.self="showAddGrade = false">
          <div class="modal-content max-w-sm">
            <div class="modal-header">
              <h3 class="text-base font-bold text-slate-100">添加年级</h3>
              <button @click="showAddGrade = false" class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500">✕</button>
            </div>
            <div class="modal-body">
              <input v-model="newGradeName" type="text" placeholder="年级名称，如：高一" class="form-input" @keyup.enter="addGrade" />
            </div>
            <div class="modal-footer">
              <button @click="showAddGrade = false" class="btn btn-ghost">取消</button>
              <button @click="addGrade" :disabled="addGradeLoading" class="btn btn-primary">添加</button>
            </div>
          </div>
        </div>
      </Teleport>
    </ClientOnly>

    <!-- 添加班级弹窗 -->
    <ClientOnly>
      <Teleport to="body">
        <div v-if="showAddClass" class="modal-backdrop" @click.self="showAddClass = false">
          <div class="modal-content max-w-sm">
            <div class="modal-header">
              <h3 class="text-base font-bold text-slate-100">添加班级</h3>
              <button @click="showAddClass = false" class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500">✕</button>
            </div>
            <div class="modal-body space-y-4">
              <div>
                <label class="block text-xs text-slate-400 mb-2 uppercase">所属年级</label>
                <select v-model="filterGradeId" class="form-input">
                  <option :value="''" disabled>请选择年级</option>
                  <option v-for="g in grades" :key="g.id" :value="g.id">{{ g.name }}</option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-slate-400 mb-2 uppercase">班级名称</label>
                <input v-model="newClassName" type="text" placeholder="班级名称，如：1班" class="form-input" @keyup.enter="addClass" />
              </div>
            </div>
            <div class="modal-footer">
              <button @click="showAddClass = false" class="btn btn-ghost">取消</button>
              <button @click="addClass" :disabled="addClassLoading" class="btn btn-primary">添加</button>
            </div>
          </div>
        </div>
      </Teleport>
    </ClientOnly>

    <!-- 添加用户弹窗 -->
    <ClientOnly>
      <Teleport to="body">
        <div v-if="showAddUser" class="modal-backdrop" @click.self="showAddUser = false">
          <div class="modal-content max-w-sm">
            <div class="modal-header">
              <h3 class="text-base font-bold text-slate-100">添加用户</h3>
              <button @click="showAddUser = false" class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500">✕</button>
            </div>
            <div class="modal-body space-y-4">
              <div>
                <label class="block text-xs text-slate-400 mb-2 uppercase">用户名</label>
                <input v-model="newUser.username" type="text" placeholder="用户名" class="form-input" />
              </div>
              <div>
                <label class="block text-xs text-slate-400 mb-2 uppercase">所属班级</label>
                <select v-model="newUser.classId" class="form-input">
                  <option :value="''" disabled>请选择班级</option>
                  <option v-for="c in allClasses" :key="c.id" :value="c.id">{{ c.gradeName ? c.gradeName + ' / ' : '' }}{{ c.name }}</option>
                </select>
              </div>
              <p class="text-xs text-slate-500">默认密码：123456</p>
            </div>
            <div class="modal-footer">
              <button @click="showAddUser = false" class="btn btn-ghost">取消</button>
              <button @click="addUser" :disabled="addUserLoading" class="btn btn-primary">添加</button>
            </div>
          </div>
        </div>
      </Teleport>
    </ClientOnly>

    <!-- 批量添加用户弹窗 -->
    <ClientOnly>
      <Teleport to="body">
        <div v-if="showBatchAddUser" class="modal-backdrop" @click.self="showBatchAddUser = false">
          <div class="modal-content max-w-sm">
            <div class="modal-header">
              <h3 class="text-base font-bold text-slate-100">批量添加用户</h3>
              <button @click="showBatchAddUser = false" class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500">✕</button>
            </div>
            <div class="modal-body space-y-4">
              <div>
                <label class="block text-xs text-slate-400 mb-2 uppercase">所属班级</label>
                <select v-model="batchClassId" class="form-input">
                  <option :value="''" disabled>请选择班级</option>
                  <option v-for="c in allClasses" :key="c.id" :value="c.id">{{ c.gradeName ? c.gradeName + ' / ' : '' }}{{ c.name }}</option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-slate-400 mb-2 uppercase">用户名（一行一个）</label>
                <textarea v-model="batchUsernames" rows="8" placeholder="一行一个用户名" class="form-input resize-none text-sm font-mono"></textarea>
              </div>
              <p class="text-xs text-slate-500">默认密码：123456</p>
            </div>
            <div class="modal-footer">
              <button @click="showBatchAddUser = false" class="btn btn-ghost">取消</button>
              <button @click="batchAddUsers" :disabled="batchAddLoading" class="btn btn-primary">添加</button>
            </div>
          </div>
        </div>
      </Teleport>
    </ClientOnly>

    <!-- 删除年级确认 -->
    <UiConfirm :show="!!confirmDeleteGrade" danger title="删除年级" :message="`确定删除年级「${confirmDeleteGrade?.name}」吗？此操作不可撤销`" @confirm="deleteGrade" @cancel="confirmDeleteGrade = null; confirmPassword = ''">
      <template #extra>
        <div class="mt-3">
          <label class="block text-xs text-slate-400 mb-2 uppercase">确认密码</label>
          <input v-model="confirmPassword" type="password" placeholder="请输入您的管理员密码" class="form-input" @keyup.enter="$emit('confirm')" />
        </div>
      </template>
    </UiConfirm>

    <!-- 删除班级确认 -->
    <UiConfirm :show="!!confirmDeleteClass" danger title="删除班级" :message="`确定删除班级「${confirmDeleteClass?.name}」吗？此操作不可撤销`" @confirm="deleteClass" @cancel="confirmDeleteClass = null; confirmPassword = ''">
      <template #extra>
        <div class="mt-3">
          <label class="block text-xs text-slate-400 mb-2 uppercase">确认密码</label>
          <input v-model="confirmPassword" type="password" placeholder="请输入您的管理员密码" class="form-input" @keyup.enter="$emit('confirm')" />
        </div>
      </template>
    </UiConfirm>

    <!-- 删除用户确认 -->
    <UiConfirm :show="!!confirmDeleteUser" danger title="删除用户" :message="`确定删除用户「${confirmDeleteUser?.username}」吗？此操作不可撤销`" @confirm="deleteUser" @cancel="confirmDeleteUser = null; confirmPassword = ''">
      <template #extra>
        <div class="mt-3">
          <label class="block text-xs text-slate-400 mb-2 uppercase">确认密码</label>
          <input v-model="confirmPassword" type="password" placeholder="请输入您的管理员密码" class="form-input" @keyup.enter="$emit('confirm')" />
        </div>
      </template>
    </UiConfirm>
  </div>
</template>
