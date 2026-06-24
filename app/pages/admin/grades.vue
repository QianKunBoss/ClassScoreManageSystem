<script setup lang="ts">
import { formatDate } from '~/utils/format'

definePageMeta({ auth: true })

const toast = useToast()
const { data: authData } = useFetch('/api/auth/me', {
  credentials: 'include', server: false, default: () => ({ success: false, admin: null }),
})
const currentUser = computed(() => authData.value?.admin || null)

// 学校列表（用于筛选）
const schools = ref<any[]>([])
// 年级列表
const grades = ref<any[]>([])
const loading = ref(false)

// 筛选
const filterSchoolId = ref<number | null>(null)

// 添加年级
const showAddModal = ref(false)
const newGrade = ref({ schoolId: null as number | null, name: '' })

// 删除确认
const confirmDelete = ref<any | null>(null)

async function loadSchools() {
  try {
    const res = await $fetch<{ success: boolean, data: any[] }>('/api/schools')
    schools.value = res.data || []
    applySchoolDefault()
  } catch {
    toast.error('加载学校列表失败')
  }
}

function applySchoolDefault() {
  // 如果是 school_admin 或 grade_admin，自动选中自己的学校
  const role = currentUser.value?.role
  const schoolId = currentUser.value?.schoolId
  if ((role === 'school_admin' || role === 'grade_admin') && schoolId) {
    filterSchoolId.value = schoolId
    newGrade.value.schoolId = schoolId
  }
}

async function loadGrades() {
  loading.value = true
  try {
    const query: any = {}
    if (filterSchoolId.value) {
      query.schoolId = filterSchoolId.value
    }
    const res = await $fetch<{ success: boolean, data: any[] }>('/api/grades', { query })
    grades.value = res.data || []
  } catch (err) {
    toast.error(err.data?.statusMessage || '加载年级列表失败')
  } finally {
    loading.value = false
  }
}

async function createGrade() {
  if (!newGrade.value.schoolId) {
    toast.error('请选择学校')
    return
  }
  if (!newGrade.value.name.trim()) {
    toast.error('请输入年级名称')
    return
  }

  try {
    await $fetch('/api/grades', {
      method: 'POST',
      body: { schoolId: newGrade.value.schoolId, name: newGrade.value.name.trim() },
    })
    toast.success('年级创建成功')
    showAddModal.value = false
    newGrade.value = { schoolId: currentUser.value?.role === 'school_admin' ? currentUser.value?.schoolId : null, name: '' }
    await loadGrades()
  } catch (err) {
    toast.error(err.data?.statusMessage || '创建失败')
  }
}

async function deleteGrade(grade: any) {
  // 获取确认密码
  const password = confirmDelete.value?.password
  if (!password) {
    toast.error('请输入确认密码')
    return
  }

  try {
    const query: any = {}
    // 超级管理员需要传递 schoolId
    if (currentUser.value?.role === 'super_admin' && filterSchoolId.value) {
      query.schoolId = filterSchoolId.value
    }
    await $fetch(`/api/grades/${grade.id}`, {
      method: 'DELETE',
      headers: { 'x-confirm-password': password },
      query,
    })
    toast.success('年级已删除')
    confirmDelete.value = null
    await loadGrades()
  } catch (err) {
    toast.error(err.data?.statusMessage || '删除失败')
  }
}

watch(filterSchoolId, () => {
  loadGrades()
})

// currentUser 加载完成后再应用学校默认值
watch(currentUser, (val) => {
  if (val) applySchoolDefault()
}, { immediate: false })

onMounted(() => {
  loadSchools()
  loadGrades()
})
</script>

<template>
  <div>
    <section class="border-b border-slate-800/50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h1 class="text-xl font-bold text-slate-100 mb-1">年级管理</h1>
        <p class="text-sm text-slate-500">管理系统中的年级信息</p>
      </div>
    </section>

    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="glass-card p-6 animate-slide-up">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-bold text-slate-100">年级列表</h2>
          <div class="flex items-center gap-3">
            <!-- 学校筛选（仅 super_admin 显示） -->
            <select
              v-if="currentUser?.role === 'super_admin'"
              v-model="filterSchoolId"
              class="form-input text-sm py-1.5 w-48"
            >
              <option :value="null">所有学校</option>
              <option v-for="s in schools" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
            <button @click="showAddModal = true" class="btn btn-primary text-sm">+ 添加年级</button>
          </div>
        </div>

        <div v-if="loading" class="text-center py-8 text-slate-500">加载中...</div>

        <div v-else-if="grades.length === 0" class="text-center py-8 text-slate-500">暂无年级数据</div>

        <div v-else class="overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>年级名称</th>
                <th>所属学校</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="grade in grades" :key="grade.id">
                <td><span class="text-sm text-slate-400">{{ grade.id }}</span></td>
                <td><span class="text-sm font-medium text-slate-200">{{ grade.name }}</span></td>
                <td class="text-sm text-slate-300">{{ grade.schoolName || '-' }}</td>
                <td class="text-xs text-slate-500">{{ formatDate(grade.createdAt) }}</td>
                <td>
                  <button @click="confirmDelete = { ...grade, password: '' }" class="btn btn-ghost text-xs py-1 px-2 !text-red-400 hover:!bg-red-500/10">删除</button>
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
        <div v-if="showAddModal" class="modal-backdrop" @click.self="showAddModal = false">
          <div class="modal-content">
            <div class="modal-header">
              <h3 class="text-base font-bold text-slate-100">添加年级</h3>
              <button @click="showAddModal = false" class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500">✕</button>
            </div>
            <div class="modal-body space-y-4">
              <div>
                <label class="block text-xs text-slate-400 mb-2 uppercase">所属学校</label>
                <select v-model="newGrade.schoolId" class="form-input" :disabled="currentUser?.role === 'school_admin'">
                  <option :value="null">请选择学校</option>
                  <option v-for="s in schools" :key="s.id" :value="s.id">{{ s.name }}</option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-slate-400 mb-2 uppercase">年级名称</label>
                <input v-model="newGrade.name" type="text" placeholder="请输入年级名称" class="form-input" />
              </div>
            </div>
            <div class="modal-footer">
              <button @click="showAddModal = false" class="btn btn-ghost">取消</button>
              <button @click="createGrade" class="btn btn-primary">创建</button>
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
              <h3 class="text-base font-bold text-red-400">删除年级</h3>
              <button @click="confirmDelete = null" class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500">✕</button>
            </div>
            <div class="modal-body space-y-4">
              <p class="text-sm text-slate-300">确定删除年级「{{ confirmDelete.name }}」吗？此操作将级联删除该年级下的所有班级和学生数据，不可撤销！</p>
              <div>
                <label class="block text-xs text-slate-400 mb-2 uppercase">确认密码</label>
                <input v-model="confirmDelete.password" type="password" placeholder="请输入您的管理员密码" class="form-input" />
              </div>
            </div>
            <div class="modal-footer">
              <button @click="confirmDelete = null" class="btn btn-ghost">取消</button>
              <button @click="deleteGrade(confirmDelete)" class="btn btn-danger">确认删除</button>
            </div>
          </div>
        </div>
      </Teleport>
    </ClientOnly>
  </div>
</template>

