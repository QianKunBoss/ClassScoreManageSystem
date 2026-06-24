<script setup lang="ts">
import { formatDate } from '~/utils/format'

definePageMeta({ auth: true })

const toast = useToast()
const { data: authData } = useFetch('/api/auth/me', {
  credentials: 'include', server: false, default: () => ({ success: false, admin: null }),
})
const currentUser = computed(() => authData.value?.admin || null)

// 年级列表（用于筛选）
const grades = ref<any[]>([])
// 班级列表
const classes = ref<any[]>([])
const loading = ref(false)

// 学校列表（超级管理员用）
const schools = ref<any[]>([])
// 学校筛选
const filterSchoolId = ref<number | null>(null)

// 筛选
const filterGradeId = ref<number | null>(null)

// 添加班级
const showAddModal = ref(false)
const newClass = ref({ gradeId: null as number | null, name: '' })

// 删除确认
const confirmDelete = ref<any | null>(null)

async function loadGrades() {
  grades.value = []
  try {
    const query: any = {}
    if (currentUser.value?.role === 'super_admin') {
      if (!filterSchoolId.value) return
      query.schoolId = filterSchoolId.value
    } else if (currentUser.value?.role === 'school_admin' && currentUser.value?.schoolId) {
      query.schoolId = currentUser.value.schoolId
    }
    const res = await $fetch<{ success: boolean, data: any[] }>('/api/grades', { query })
    grades.value = res.data || []
    applyGradeDefault()
  } catch {
    toast.error('加载年级列表失败')
  }
}

function applyGradeDefault() {
  if (currentUser.value?.role === 'grade_admin' && currentUser.value?.gradeId) {
    filterGradeId.value = currentUser.value.gradeId
    newClass.value.gradeId = currentUser.value.gradeId
  }
}

async function loadClasses() {
  loading.value = true
  try {
    const query: any = {}
    if (filterGradeId.value) {
      query.gradeId = filterGradeId.value
    }
    if (currentUser.value?.role === 'super_admin' && filterSchoolId.value) {
      query.schoolId = filterSchoolId.value
    }
    const res = await $fetch<{ success: boolean, data: any[] }>('/api/classes', { query })
    classes.value = res.data || []
  } catch (err) {
    toast.error(err.data?.statusMessage || '加载班级列表失败')
  } finally {
    loading.value = false
  }
}

async function createClass() {
  if (!newClass.value.gradeId) {
    toast.error('请选择年级')
    return
  }
  if (!newClass.value.name.trim()) {
    toast.error('请输入班级名称')
    return
  }

  try {
    await $fetch('/api/classes', {
      method: 'POST',
      query: currentUser.value?.role === 'super_admin' && filterSchoolId.value
        ? { schoolId: filterSchoolId.value }
        : {},
      body: { gradeId: newClass.value.gradeId, name: newClass.value.name.trim() },
    })
    toast.success('班级创建成功')
    showAddModal.value = false
    newClass.value = { gradeId: currentUser.value?.role === 'grade_admin' ? currentUser.value?.gradeId : null, name: '' }
    await loadClasses()
  } catch (err) {
    toast.error(err.data?.statusMessage || '创建失败')
  }
}

async function deleteClass(cls: any) {
  // 获取确认密码
  const password = confirmDelete.value?.password
  if (!password) {
    toast.error('请输入确认密码')
    return
  }

  try {
    const query: any = {}
    if (currentUser.value?.role === 'super_admin') {
      if (!filterSchoolId.value) {
        toast.error('请先选择学校')
        return
      }
      query.schoolId = filterSchoolId.value
    }
    await $fetch(`/api/classes/${cls.id}`, {
      method: 'DELETE',
      headers: { 'x-confirm-password': password },
      query,
    })
    toast.success('班级已删除')
    confirmDelete.value = null
    await loadClasses()
  } catch (err) {
    toast.error(err.data?.statusMessage || '删除失败')
  }
}

function navigateToAdmin(cls: any) {
  navigateTo(`/admin?classId=${cls.id}`)
}

watch(filterGradeId, () => {
  loadClasses()
})

watch(filterSchoolId, () => {
  loadGrades()
  loadClasses()
})

// currentUser 加载完成后初始化（解决 useFetch 异步时序问题）
watch(currentUser, async (val) => {
  if (!val) return
  if (val.role === 'super_admin') {
    try {
      const res = await $fetch<{ success: boolean, data: any[] }>('/api/schools')
      schools.value = res.data || []
    } catch {
      toast.error('加载学校列表失败')
    }
  }
  await loadGrades()
  applyGradeDefault()
}, { immediate: false })

onMounted(async () => {
  // 如果 currentUser 已经有值（极少数情况），直接初始化
  if (currentUser.value?.role === 'super_admin') {
    try {
      const res = await $fetch<{ success: boolean, data: any[] }>('/api/schools')
      schools.value = res.data || []
    } catch {
      toast.error('加载学校列表失败')
    }
  }
  loadGrades()
  loadClasses()
})
</script>

<template>
  <div>
    <section class="border-b border-slate-800/50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h1 class="text-xl font-bold text-slate-100 mb-1">班级管理</h1>
        <p class="text-sm text-slate-500">管理系统中的班级信息</p>
      </div>
    </section>

    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="glass-card p-6 animate-slide-up">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-bold text-slate-100">班级列表</h2>
          <div class="flex items-center gap-3">
            <!-- 学校筛选（仅超级管理员显示） -->
            <select
              v-if="currentUser?.role === 'super_admin'"
              v-model="filterSchoolId"
              class="form-input text-sm py-1.5 w-48"
            >
              <option :value="null">请选择学校</option>
              <option v-for="s in schools" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
            <!-- 年级筛选 -->
            <select
              v-model="filterGradeId"
              class="form-input text-sm py-1.5 w-48"
            >
              <option :value="null">所有年级</option>
              <option v-for="g in grades" :key="g.id" :value="g.id">{{ g.schoolName }} - {{ g.name }}</option>
            </select>
            <button @click="showAddModal = true" class="btn btn-primary text-sm">+ 添加班级</button>
          </div>
        </div>

        <div v-if="loading" class="text-center py-8 text-slate-500">加载中...</div>

        <div v-else-if="classes.length === 0" class="text-center py-8 text-slate-500">暂无班级数据</div>

        <div v-else class="overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>班级名称</th>
                <th>所属年级</th>
                <th>所属学校</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="cls in classes" :key="cls.id">
                <td><span class="text-sm text-slate-400">{{ cls.id }}</span></td>
                <td><span class="text-sm font-medium text-slate-200">{{ cls.name }}</span></td>
                <td class="text-sm text-slate-300">{{ cls.gradeName || '-' }}</td>
                <td class="text-sm text-slate-300">{{ cls.schoolName || '-' }}</td>
                <td class="text-xs text-slate-500">{{ formatDate(cls.createdAt) }}</td>
                <td>
                  <div class="flex items-center gap-2">
                    <button @click="navigateToAdmin(cls)" class="btn btn-ghost text-xs py-1 px-2 text-blue-400 hover:!bg-blue-500/10">进入管理</button>
                    <button @click="confirmDelete = { ...cls, password: '' }" class="btn btn-ghost text-xs py-1 px-2 !text-red-400 hover:!bg-red-500/10">删除</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- 添加班级弹窗 -->
    <ClientOnly>
      <Teleport to="body">
        <div v-if="showAddModal" class="modal-backdrop" @click.self="showAddModal = false">
          <div class="modal-content">
            <div class="modal-header">
              <h3 class="text-base font-bold text-slate-100">添加班级</h3>
              <button @click="showAddModal = false" class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500">✕</button>
            </div>
            <div class="modal-body space-y-4">
              <div>
                <label class="block text-xs text-slate-400 mb-2 uppercase">所属年级</label>
                <select v-model="newClass.gradeId" class="form-input" :disabled="currentUser?.role === 'grade_admin'">
                  <option :value="null">请选择年级</option>
                  <option v-for="g in grades" :key="g.id" :value="g.id">{{ g.schoolName }} - {{ g.name }}</option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-slate-400 mb-2 uppercase">班级名称</label>
                <input v-model="newClass.name" type="text" placeholder="请输入班级名称" class="form-input" />
              </div>
            </div>
            <div class="modal-footer">
              <button @click="showAddModal = false" class="btn btn-ghost">取消</button>
              <button @click="createClass" class="btn btn-primary">创建</button>
            </div>
          </div>
        </div>
      </Teleport>
    </ClientOnly>

    <!-- 删除确认弹窗 -->
    <ClientOnly>
      <Teleport to="body">
        <div v-if="confirmDelete" class="modal-backdrop" @click.self="confirmDelete = null">
          <div class="modal-content max-w-sm">
            <div class="modal-header">
              <h3 class="text-base font-bold text-red-400">删除班级</h3>
              <button @click="confirmDelete = null" class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500">✕</button>
            </div>
            <div class="modal-body space-y-4">
              <p class="text-sm text-slate-300">确定删除班级「{{ confirmDelete.name }}」吗？此操作将级联删除该班级下的所有学生、积分记录等数据，不可撤销！</p>
              <div>
                <label class="block text-xs text-slate-400 mb-2 uppercase">确认密码</label>
                <input v-model="confirmDelete.password" type="password" placeholder="请输入您的管理员密码" class="form-input" />
              </div>
            </div>
            <div class="modal-footer">
              <button @click="confirmDelete = null" class="btn btn-ghost">取消</button>
              <button @click="deleteClass(confirmDelete)" class="btn btn-danger">确认删除</button>
            </div>
          </div>
        </div>
      </Teleport>
    </ClientOnly>
  </div>
</template>

