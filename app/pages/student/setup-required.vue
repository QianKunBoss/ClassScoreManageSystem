<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from '~/composables/useToast'
import { useRouter } from 'vue-router'
import SecuritySetup from '~/components/security/SecuritySetup.vue'

definePageMeta({ middleware: 'student', layout: 'blank' })

const toast = useToast()
const router = useRouter()

const initialEmail = ref<string | null>(null)
const emailConfigured = ref(true)
const ready = ref(false)

onMounted(async () => {
  try {
    const res = await $fetch<{ success: boolean; student: any }>('/api/auth/student/me', { credentials: 'include' })
    if (!res.success || !res.student) {
      await router.replace('/login')
      return
    }
    // 已完成安全设置（已绑定邮箱且无需改密）→ 直接进主页
    if (res.student.email && !res.student.mustChangePassword) {
      await router.replace('/student')
      return
    }
    initialEmail.value = res.student.email || null
    emailConfigured.value = !!res.student.emailServiceConfigured
    ready.value = true
  } catch {
    await router.replace('/login')
  }
})

function onDone() {
  toast.success('安全设置已完成，正在进入系统')
  router.replace('/student')
}
</script>

<template>
  <div v-if="ready" class="min-h-screen">
    <SecuritySetup role="student" :initial-email="initialEmail" :email-service-configured="emailConfigured" force @done="onDone" />
  </div>
</template>
