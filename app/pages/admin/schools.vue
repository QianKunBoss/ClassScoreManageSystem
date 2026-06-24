<script setup lang="ts">
import { formatDate } from '~/utils/format'

definePageMeta({ middleware: 'super-admin' })

const toast = useToast()
const { data: authData } = useFetch('/api/auth/me', {
  credentials: 'include', server: false, default: () => ({ success: false, admin: null }),
})
const currentUser = computed(() => authData.value?.admin || null)

// 学校列表
const schools = ref<any[]>([])
const loading = ref(false)

// 筛选
const filterSchoolId = ref<number | null>(null)

// 添加学校
const showAddModal = ref(false)
const newSchool = ref({ name: '' })

// 编辑学校
const showEditModal = ref(false)
const editingSchool = ref<any>(null)

// 删除确认
const confirmDelete = ref<any | null>(null)

async function loadSchools() {
  loading.value = true
  try {
    const res = await $fetch<{ success: boolean, data: any[] }>('/api/schools')
    schools.value = res.data || []
  } catch (err) {
    toast.error(err.data?.statusMessage || '加载学校列表失败')
  } finally {
    loading.value = false
  }
}

async function createSchool() {
  if (!newSchool.value.name.trim()) {
    toast.error('请输入学校名称')
    return
  }

  try {
    await $fetch('/api/schools', {
      method: 'POST',
      body: { name: newSchool.value.name.trim() },
    })
    toast.success('学校创建成功')
    showAddModal.value = false
    newSchool.value = { name: '' }
    await loadSchools()
  } catch (err) {
    toast.error(err.data?.statusMessage || '创建失败')
  }
}

async function deleteSchool(school: any) {
  // 获取确认密码
  const password = confirmDelete.value?.password
  if (!password) {
    toast.error('请输入确认密码')
    return
  }

  try {
    await $fetch(`/api/schools/${school.id}`, {
      method: 'DELETE',
      headers: { 'x-confirm-password': password },
    })
    toast.success('学校已删除')
    confirmDelete.value = null
    await loadSchools()
  } catch (err) {
    toast.error(err.data?.statusMessage || '删除失败')
  }
}

function editSchool(school: any) {
  editingSchool.value = { ...school, password: '' }
  showEditModal.value = true
}

async function updateSchool() {
  if (!editingSchool.value?.name?.trim()) {
    toast.error('请输入学校名称')
    return
  }

  try {
    await $fetch(`/api/schools/${editingSchool.value.id}`, {
      method: 'PATCH',
      body: { name: editingSchool.value.name.trim() },
    })
    toast.success('学校信息已更新')
    showEditModal.value = false
    editingSchool.value = null
    await loadSchools()
  } catch (err) {
    toast.error(err.data?.statusMessage || '更新失败')
  }
}

onMounted(() => {
  loadSchools()
})
</script>

<template>
  <div>
    <section class="border-b border-slate-800/50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h1 class="text-xl font-bold text-slate-100 mb-1">学校管理</h1>
        <p class="text-sm text-slate-500">管理系统中的学校信息</p>
      </div>
    </section>

    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="glass-card p-6 animate-slide-up">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-bold text-slate-100">学校列表</h2>
          <button @click="showAddModal = true" class="btn btn-primary text-sm">+ 添加学校</button>
        </div>

        <div v-if="loading" class="text-center py-8 text-slate-500">加载中...</div>

        <div v-else-if="schools.length === 0" class="text-center py-8 text-slate-500">暂无学校数据</div>

        <div v-else class="overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>学校名称</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="school in schools" :key="school.id">
                <td><span class="text-sm text-slate-400">{{ school.id }}</span></td>
                <td><span class="text-sm font-medium text-slate-200">{{ school.name }}</span></td>
                <td class="text-xs text-slate-500">{{ formatDate(school.createdAt) }}</td>
                <td>
                  <button @click="editSchool(school)" class="btn btn-ghost text-xs py-1 px-2 !text-indigo-400 hover:!bg-indigo-500/10 mr-2">编辑</button>
                  <button @click="confirmDelete = { ...school, password: '' }" class="btn btn-ghost text-xs py-1 px-2 !text-red-400 hover:!bg-red-500/10">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- 添加学校弹窗 -->
    <ClientOnly>
      <Teleport to="body">
        <div v-if="showAddModal" class="modal-backdrop" @click.self="showAddModal = false">
          <div class="modal-content">
            <div class="modal-header">
              <h3 class="text-base font-bold text-slate-100">添加学校</h3>
              <button @click="showAddModal = false" class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500">✕</button>
            </div>
            <div class="modal-body space-y-4">
              <div>
                <label class="block text-xs text-slate-400 mb-2 uppercase">学校名称</label>
                <input v-model="newSchool.name" type="text" placeholder="请输入学校名称" class="form-input" />
              </div>
            </div>
            <div class="modal-footer">
              <button @click="showAddModal = false" class="btn btn-ghost">取消</button>
              <button @click="createSchool" class="btn btn-primary">创建</button>
            </div>
          </div>
        </div>
      </Teleport>
    </ClientOnly>

    <!-- 编辑学校弹窗 -->
    <ClientOnly>
      <Teleport to="body">
        <div v-if="showEditModal" class="modal-backdrop" @click.self="showEditModal = false">
          <div class="modal-content">
            <div class="modal-header">
              <h3 class="text-base font-bold text-slate-100">编辑学校</h3>
              <button @click="showEditModal = false" class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500">✕</button>
            </div>
            <div class="modal-body space-y-4">
              <div>
                <label class="block text-xs text-slate-400 mb-2 uppercase">学校名称</label>
                <input v-model="editingSchool.name" type="text" placeholder="请输入学校名称" class="form-input" />
              </div>
            </div>
            <div class="modal-footer">
              <button @click="showEditModal = false" class="btn btn-ghost">取消</button>
              <button @click="updateSchool" class="btn btn-primary">保存</button>
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
              <h3 class="text-base font-bold text-red-400">删除学校</h3>
              <button @click="confirmDelete = null" class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500">✕</button>
            </div>
            <div class="modal-body space-y-4">
              <p class="text-sm text-slate-300">确定删除学校「{{ confirmDelete.name }}」吗？此操作将级联删除该学校下的所有年级、班级和学生数据，不可撤销！</p>
              <div>
                <label class="block text-xs text-slate-400 mb-2 uppercase">确认密码</label>
                <input v-model="confirmDelete.password" type="password" placeholder="请输入您的管理员密码" class="form-input" />
              </div>
            </div>
            <div class="modal-footer">
              <button @click="confirmDelete = null" class="btn btn-ghost">取消</button>
              <button @click="deleteSchool(confirmDelete)" class="btn btn-danger">确认删除</button>
            </div>
          </div>
        </div>
      </Teleport>
    </ClientOnly>
  </div>
</template>

