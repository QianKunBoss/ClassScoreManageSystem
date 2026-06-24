<script setup lang="ts">
import type { ScoreTemplate } from '~/types'

const props = defineProps<{ schoolId?: number | null }>()
const toast = useToast()
const emit = defineEmits<{ updated: [] }>()

const templates = ref<ScoreTemplate[]>([])
const loading = ref(true)
const editing = ref<ScoreTemplate | null>(null)
const form = ref({ name: '', scoreChange: 1, description: '' })

async function loadTemplates() {
  loading.value = true
  try {
    const res = await $fetch<{ data: ScoreTemplate[] }>('/api/scores/templates')
    templates.value = res.data
  } catch (err) { console.error(err) }
  finally { loading.value = false }
}

onMounted(loadTemplates)

function resetForm() {
  form.value = { name: '', scoreChange: 1, description: '' }
  editing.value = null
}

function edit(t: ScoreTemplate) {
  editing.value = t
  form.value = { name: t.name, scoreChange: t.scoreChange, description: t.description || '' }
}

async function saveTemplate() {
  if (!form.value.name) { toast.error('请输入模板名称'); return }
  try {
    const body: any = { name: form.value.name, score_change: form.value.scoreChange, description: form.value.description }
    // 超级管理员需要传递 schoolId
    if (props.schoolId) {
      body.schoolId = props.schoolId
    }
    if (editing.value) {
      await $fetch(`/api/scores/templates/${editing.value.id}`, {
        method: 'PATCH',
        body,
      })
    } else {
      await $fetch('/api/scores/templates', {
        method: 'POST',
        body,
      })
    }
    resetForm()
    await loadTemplates()
    emit('updated')
  } catch (err) { alert(err.data?.message || '保存失败') }
}

async function deleteTemplate(id: number) {
  if (!confirm('确定删除此模板？')) return
  try {
    const query: any = {}
    if (props.schoolId) {
      query.schoolId = props.schoolId
    }
    await $fetch(`/api/scores/templates/${id}`, { method: 'DELETE', query })
    await loadTemplates()
    emit('updated')
  } catch (err) { alert(err.data?.message || '删除失败') }
}
</script>

<template>
  <div>
    <!-- 添加表单 -->
    <div class="flex gap-3 mb-4 items-end">
      <div class="flex-1">
        <label class="block text-xs text-slate-400 mb-1">名称</label>
        <input v-model="form.name" type="text" placeholder="模板名称" class="form-input py-2" />
      </div>
      <div class="w-24">
        <label class="block text-xs text-slate-400 mb-1">分数</label>
        <input v-model.number="form.scoreChange" type="number" class="form-input py-2 text-center" />
      </div>
      <div class="flex-1">
        <label class="block text-xs text-slate-400 mb-1">描述</label>
        <input v-model="form.description" type="text" placeholder="描述说明" class="form-input py-2" />
      </div>
      <button @click="saveTemplate" class="btn btn-primary py-2">
        {{ editing ? '更新' : '添加' }}
      </button>
      <button v-if="editing" @click="resetForm" class="btn btn-ghost py-2">取消</button>
    </div>

    <!-- 列表 -->
    <div v-if="loading" class="text-center py-4 text-slate-500 text-sm">加载中...</div>
    <div v-else-if="templates.length > 0" class="space-y-2 max-h-64 overflow-y-auto">
      <div
        v-for="t in templates"
        :key="t.id"
        class="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800/30 transition-all group"
      >
        <span :class="`text-xs font-bold w-12 text-right ${t.scoreChange > 0 ? 'text-green-400' : 'text-red-400'}`">
          {{ t.scoreChange > 0 ? '+' : '' }}{{ t.scoreChange }}
        </span>
        <div class="flex-1">
          <p class="text-sm text-slate-200">{{ t.name }}</p>
          <p class="text-xs text-slate-600">{{ t.description || '-' }}</p>
        </div>
        <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button @click="edit(t)" class="text-xs text-indigo-400 hover:text-indigo-300">编辑</button>
          <button @click="deleteTemplate(t.id)" class="text-xs text-red-400 hover:text-red-300">删除</button>
        </div>
      </div>
    </div>
    <div v-else class="text-center py-8 text-slate-600 text-sm">暂无模板</div>
  </div>
</template>

