<script setup lang="ts">
/**
 * 删除年级 / 班级的确认弹窗（需超级管理员密码二次验证）
 * 与学校详情页的删除流程保持一致，额外突出级联删除影响。
 */
interface DeleteOrgTarget {
  kind: 'grade' | 'class'
  name: string
  schoolId: number
  gradeId: number
  classId?: number
  classCount?: number
}

const props = defineProps<{
  show: boolean
  target: DeleteOrgTarget | null
}>()

const emit = defineEmits<{ close: []; deleted: [] }>()

const toast = useToast()
const password = ref('')
const deleting = ref(false)

watch(() => props.show, (visible) => {
  if (visible) {
    password.value = ''
    deleting.value = false
  }
})

const title = computed(() => (props.target?.kind === 'class' ? '删除班级' : '删除年级'))

const impact = computed(() => {
  const t = props.target
  if (!t) return ''
  if (t.kind === 'class') {
    return '该班级下的所有学生与积分记录将一并删除，且不可恢复。'
  }
  const n = t.classCount ?? 0
  return n > 0
    ? `该年级下的 ${n} 个班级及其学生、积分记录将一并删除，且不可恢复。`
    : '该年级下的班级与学生、积分记录将一并删除，且不可恢复。'
})

function close() {
  if (deleting.value) return
  emit('close')
}

async function confirm() {
  if (deleting.value) return
  const t = props.target
  if (!t) return
  if (!password.value) {
    toast.error('请输入确认密码')
    return
  }
  deleting.value = true
  try {
    const url = t.kind === 'class' ? `/api/classes/${t.classId}` : `/api/grades/${t.gradeId}`
    await $fetch(url, {
      method: 'DELETE',
      headers: { 'x-confirm-password': password.value },
      query: { schoolId: t.schoolId },
    })
    toast.success(t.kind === 'class' ? '班级已删除' : '年级已删除')
    password.value = ''
    emit('deleted')
    emit('close')
  } catch (err: any) {
    toast.error(err?.data?.message || err?.data?.statusMessage || '删除失败')
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <UiConfirm
    :show="show"
    danger
    :title="title"
    :message="target ? `确定删除「${target.name}」吗？${impact}` : ''"
    :confirm-text="deleting ? '删除中…' : '确认删除'"
    @confirm="confirm"
    @cancel="close"
  >
    <template #extra>
      <label class="mt-4 block text-xs font-medium text-slate-400">超级管理员密码</label>
      <input
        v-model="password"
        type="password"
        autocomplete="off"
        placeholder="请输入您的登录密码"
        class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700/60 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-brand-500/60"
        @keyup.enter="confirm"
      />
    </template>
  </UiConfirm>
</template>
