<script setup lang="ts">
import { Mail, Send, Check, Shield, LogOut, RefreshCw, AlertTriangle } from '~/utils/icons'
definePageMeta({ middleware: 'student', layout: 'blank' })

const toast = useToast()
const router = useRouter()

const student = ref<any>(null)
const email = ref('')
const code = ref('')
const sending = ref(false)
const binding = ref(false)
const cooldown = ref(0)
let cooldownTimer: ReturnType<typeof setInterval> | null = null

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const canSend = computed(() => EMAIL_RE.test(email.value.trim()) && cooldown.value === 0 && !sending.value)

async function loadMe() {
  try {
    const res = await $fetch<{ success: boolean; student: any }>('/api/auth/student/me', { credentials: 'include' })
    if (res.success && res.student) {
      student.value = res.student
      // 已绑定则直接放行
      if (res.student.email) {
        await router.replace('/student')
      }
    } else {
      await router.replace('/login')
    }
  } catch {
    await router.replace('/login')
  }
}

onMounted(loadMe)

async function sendCode() {
  if (!canSend.value) return
  sending.value = true
  try {
    const res = await $fetch('/api/auth/student/bind-email/send-code', {
      method: 'POST',
      credentials: 'include',
      body: { email: email.value.trim().toLowerCase() },
    })
    toast.success(res.message || '验证码已发送')
    startCooldown()
  } catch (err: any) {
    const msg = err.data?.message || err.data?.statusMessage || '发送失败'
    toast.error(msg)
    // 服务端返回冷却剩余时间时同步倒计时
    if (err.data?.remainingMs) startCooldown(Math.ceil(err.data.remainingMs / 1000))
  } finally {
    sending.value = false
  }
}

function startCooldown(secs = 60) {
  cooldown.value = secs
  if (cooldownTimer) clearInterval(cooldownTimer)
  cooldownTimer = setInterval(() => {
    cooldown.value--
    if (cooldown.value <= 0 && cooldownTimer) {
      clearInterval(cooldownTimer)
      cooldownTimer = null
    }
  }, 1000)
}

onBeforeUnmount(() => {
  if (cooldownTimer) clearInterval(cooldownTimer)
})

async function bind() {
  if (!email.value.trim() || !code.value.trim()) {
    toast.error('请填写邮箱与验证码')
    return
  }
  binding.value = true
  try {
    const res = await $fetch('/api/auth/student/bind-email/verify', {
      method: 'POST',
      credentials: 'include',
      body: { email: email.value.trim().toLowerCase(), code: code.value.trim() },
    })
    toast.success(res.message || '绑定成功')
    await router.replace('/student')
  } catch (err: any) {
    toast.error(err.data?.message || err.data?.statusMessage || '绑定失败')
  } finally {
    binding.value = false
  }
}

function logout() {
  $fetch('/api/auth/student/logout', { method: 'POST', credentials: 'include' })
    .catch(() => {})
    .finally(() => router.replace('/login'))
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-[#0a0a1a]">
    <!-- 顶部极简栏：仅退出 -->
    <header class="h-14 flex items-center justify-between px-4 sm:px-6 border-b border-slate-800/50">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg overflow-hidden bg-brand-500 p-1">
          <img src="/favicon.ico" alt="CSMS" class="w-full h-full object-contain" />
        </div>
        <span class="text-sm font-bold text-slate-100">CSMS 学生端</span>
      </div>
      <button
        @click="logout"
        class="text-xs px-3 py-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/5 transition-all duration-200 flex items-center gap-1.5"
      >
        <MorphIcon :icon="LogOut" :size="14" /> 退出
      </button>
    </header>

    <main class="flex-1 flex items-center justify-center px-4 py-10">
      <div class="w-full max-w-md">
        <div class="glass-card p-8">
          <div class="mb-6 text-center">
            <div class="inline-flex w-14 h-14 rounded-2xl bg-brand-500/10 items-center justify-center mb-4">
              <MorphIcon :icon="Shield" :size="28" class="text-brand-400" />
            </div>
            <h1 class="text-xl font-bold text-slate-100">绑定邮箱</h1>
            <p class="text-sm text-slate-500 mt-1">
              为保障账号安全，请先绑定邮箱<span v-if="student">（{{ student.actualName || student.username }}）</span>
            </p>
          </div>

          <div class="space-y-5">
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">电子邮箱</label>
              <input
                v-model="email"
                type="email"
                placeholder="请输入您的邮箱"
                class="form-input"
                :disabled="binding"
                @keyup.enter="sendCode"
              />
            </div>

            <div>
              <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">验证码</label>
              <div class="flex gap-2">
                <input
                  v-model="code"
                  type="text"
                  inputmode="numeric"
                  placeholder="6 位验证码"
                  class="form-input flex-1"
                  :disabled="binding"
                  @keyup.enter="bind"
                />
                <button
                  type="button"
                  :disabled="!canSend"
                  @click="sendCode"
                  class="btn btn-ghost text-sm whitespace-nowrap min-w-[104px]"
                >
                  <span v-if="cooldown > 0" class="tabular-nums">{{ cooldown }} 秒后重发</span>
                  <span v-else-if="sending" class="flex items-center gap-1.5"><MorphIcon :icon="RefreshCw" :size="14" class="animate-spin" /> 发送中</span>
                  <span v-else class="flex items-center gap-1.5"><MorphIcon :icon="Send" :size="14" /> 获取验证码</span>
                </button>
              </div>
            </div>

            <div class="flex items-start gap-2 text-xs text-slate-500">
              <MorphIcon :icon="AlertTriangle" :size="14" class="text-amber-400 shrink-0 mt-0.5" />
              <span>验证码 10 分钟内有效，发送至您的邮箱。绑定后可用于找回密码。</span>
            </div>

            <button
              type="button"
              :disabled="binding"
              @click="bind"
              class="btn btn-primary w-full py-3"
            >
              <span v-if="binding" class="flex items-center gap-2">
                <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                绑定中...
              </span>
              <span v-else class="flex items-center gap-1.5"><MorphIcon :icon="Check" :size="16" /> 完成绑定</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
