<script setup lang="ts">
import type { ScoreTemplate } from '~/types'

definePageMeta({ auth: true })

const { data: authData } = useFetch('/api/auth/me', {
  credentials: 'include', server: false,
  default: () => ({ success: false, admin: null }),
})
const toast = useToast()

const currentUser = computed(() => authData.value?.admin || null)

// 学校列表（超级管理员用）
const schools = ref<any[]>([])
const filterSchoolId = ref<number | null>(null)

const templates = ref<ScoreTemplate[]>([])
const loading = ref(true)
const showAddModal = ref(false)
const editing = ref<ScoreTemplate | null>(null)

const form = ref({ name: '', scoreChange: 1, description: '' })

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
    // 超级管理员需要传递 schoolId
    if (currentUser.value?.role === 'super_admin') {
      if (!filterSchoolId.value) {
        templates.value = []
        loading.value = false
        return
      }
      query.schoolId = filterSchoolId.value
    }
    
    const res = await $fetch<{ data: ScoreTemplate[] }>('/api/scores/templates', { params: query })
    templates.value = res.data
  } catch (err) { console.error(err) }
  finally { loading.value = false }
})

function resetForm() {
  form.value = { name: '', scoreChange: 1, description: '' }
  editing.value = null
}

function edit(t: ScoreTemplate) {
  editing.value = t
  form.value = { name: t.name, scoreChange: t.scoreChange, description: t.description || '' }
  showAddModal.value = true
}

async function saveTemplate() {
  if (!form.value.name) { toast.error('请输入模板名称'); return }
  try {
    const query: any = {}
    // 超级管理员需要传递 schoolId
    if (currentUser.value?.role === 'super_admin' && filterSchoolId.value) {
      query.schoolId = filterSchoolId.value
    }
    
    if (editing.value) {
      await $fetch(`/api/scores/templates/${editing.value.id}`, {
        method: 'PATCH',
        body: { name: form.value.name, score_change: form.value.scoreChange, description: form.value.description },
        query,
      })
    } else {
      await $fetch('/api/scores/templates', {
        method: 'POST',
        body: { name: form.value.name, score_change: form.value.scoreChange, description: form.value.description },
        query,
      })
    }
    showAddModal.value = false
    resetForm()
    
    // 重新加载模板列表
    const refreshQuery: any = {}
    if (currentUser.value?.role === 'super_admin' && filterSchoolId.value) {
      refreshQuery.schoolId = filterSchoolId.value
    }
    const res = await $fetch<{ data: ScoreTemplate[] }>('/api/scores/templates', { params: refreshQuery })
    templates.value = res.data
    toast.success(editing.value ? '模板已更新' : '模板已创建')
  } catch (err) { toast.error(err.data?.message || '保存失败') }
}

const showDeleteConfirm = ref(false)
const deletingId = ref<number | null>(null)

function confirmDelete(id: number) {
  deletingId.value = id
  showDeleteConfirm.value = true
}

async function deleteTemplate() {
  if (!deletingId.value) return
  try {
    const query: any = {}
    // 超级管理员需要传递 schoolId
    if (currentUser.value?.role === 'super_admin' && filterSchoolId.value) {
      query.schoolId = filterSchoolId.value
    }
    await $fetch(`/api/scores/templates/${deletingId.value}`, { method: 'DELETE', query })
    
    // 重新加载模板列表
    const refreshQuery: any = {}
    if (currentUser.value?.role === 'super_admin' && filterSchoolId.value) {
      refreshQuery.schoolId = filterSchoolId.value
    }
    const res = await $fetch<{ data: ScoreTemplate[] }>('/api/scores/templates', { params: refreshQuery })
    templates.value = res.data
    toast.success('模板已删除')
  } catch (err) { toast.error(err.data?.message || '删除失败') }
  finally { showDeleteConfirm.value = false; deletingId.value = null }
}
</script>

<template>
  <div>
    <section class="border-b border-slate-800/50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-slate-100 mb-1">快捷模板管理</h1>
          <p class="text-sm text-slate-500">管理积分加减分的快捷模板</p>
        </div>
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
          <button @click="resetForm(); showAddModal = true" class="btn btn-primary">+ 添加模板</button>
        </div>
      </div>
    </section>

    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="glass-card p-6 animate-slide-up">
        <div v-if="loading" class="space-y-3">
          <div v-for="i in 4" :key="i" class="h-14 rounded-lg bg-slate-800/40 animate-pulse"></div>
        </div>
        <div v-else-if="templates.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="t in templates"
            :key="t.id"
            class="p-4 rounded-xl border border-slate-700/50 bg-slate-800/30 hover:border-indigo-500/30 transition-all group"
          >
            <div class="flex items-start justify-between mb-2">
              <h3 class="text-sm font-bold text-slate-100">{{ t.name }}</h3>
              <span :class="`text-xs font-bold px-2 py-0.5 rounded-full ${t.scoreChange > 0 ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`">
                {{ t.scoreChange > 0 ? '+' : '' }}{{ t.scoreChange }}
              </span>
            </div>
            <p class="text-xs text-slate-500 mb-3">{{ t.description || '无描述' }}</p>
            <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button @click="edit(t)" class="text-xs text-indigo-400 hover:text-indigo-300">编辑</button>
              <button @click="confirmDelete(t.id)" class="text-xs text-red-400 hover:text-red-300">删除</button>
            </div>
          </div>
        </div>
        <div v-else class="text-center py-12 text-slate-600 text-sm">暂无模板</div>
      </div>
    </section>

    <!-- 添加/编辑模态框 -->
    <ClientOnly>
      <Teleport to="body">
        <div v-if="showAddModal" class="modal-backdrop" @click.self="showAddModal = false">
          <div class="modal-content">
            <div class="modal-header">
              <h3 class="text-base font-bold text-slate-100">{{ editing ? '编辑模板' : '添加模板' }}</h3>
              <button @click="showAddModal = false" class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500">✕</button>
            </div>
            <div class="modal-body space-y-4">
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase">名称</label>
                <input v-model="form.name" type="text" placeholder="如：课堂表现优秀" class="form-input" />
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase">分数（正数为加分，负数为扣分）</label>
                <input v-model.number="form.scoreChange" type="number" class="form-input" />
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase">描述</label>
                <textarea v-model="form.description" placeholder="模板描述..." rows="2" class="form-input resize-none"></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button @click="showAddModal = false" class="btn btn-ghost">取消</button>
              <button @click="saveTemplate" class="btn btn-primary">保存</button>
            </div>
          </div>
        </div>
      </Teleport>
    </ClientOnly>

    <UiConfirm :show="showDeleteConfirm" danger title="删除模板" message="确定要删除此模板吗？" @confirm="deleteTemplate" @cancel="showDeleteConfirm = false" />
  </div>
</template>

