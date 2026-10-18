<script setup lang="ts">
const { user, impersonator } = useAuth()
const toast = useToast()
const exiting = ref(false)

const orgLabel = computed(() => {
  const u = user.value as any
  if (!u) return ''
  const roleName: Record<string, string> = {
    super_admin: '超级管理员',
    school_admin: '学校管理员',
    grade_admin: '年级管理员',
    class_admin: '班级管理员',
  }
  return [u.schoolName, roleName[u.role] || u.role].filter(Boolean).join(' · ')
})

async function exitImpersonation() {
  if (exiting.value) return
  exiting.value = true
  try {
    await $fetch('/api/admin/impersonation/exit', { method: 'POST' })
    await refreshNuxtData('auth-me')
    toast.success('已退出模拟，恢复超级管理员身份')
    await navigateTo('/superadmin')
  } catch (err: any) {
    toast.error(err?.data?.message || err?.data?.statusMessage || '退出失败')
  } finally {
    exiting.value = false
  }
}
</script>

<template>
  <div
    v-if="impersonator"
    class="sticky top-0 z-40 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-200"
  >
    <span>
      正在以
      <strong class="font-semibold text-amber-100">{{ user?.username }}</strong>
      <span v-if="orgLabel" class="text-amber-300/80">（{{ orgLabel }}）</span>
      身份操作
    </span>
    <span class="text-amber-500/40">|</span>
    <span class="text-amber-300/70">原身份：{{ impersonator.username }}</span>
    <button
      type="button"
      :disabled="exiting"
      class="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-medium text-amber-200 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
      @click="exitImpersonation"
    >
      {{ exiting ? '退出中…' : '退出模拟' }}
    </button>
  </div>
</template>
