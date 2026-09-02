<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'
import { useToast } from '~/composables/useToast'
import {
  Mail, Send, Check, Shield, Lock, KeyRound, AlertTriangle, RefreshCw,
} from '~/utils/icons'

const props = defineProps<{
  role: 'admin' | 'student'
  initialEmail?: string | null
  /** 是否强制模式（不可关闭）：默认 true */
  force?: boolean
  /** 系统是否已配置邮件服务（启用至少一个 SMTP）。未配置时邮箱绑定可跳过 */
  emailServiceConfigured?: boolean
}>()

const emit = defineEmits<{ done: [] }>()

const toast = useToast()
const force = computed(() => props.force !== false)
const emailConfigured = computed(() => props.emailServiceConfigured !== false)

const base = computed(() => `/api/auth/${props.role}`)
const emailBound = ref(!!props.initialEmail)

// 步骤：先改密码（始终可用），再按需绑邮箱
const step = ref<'password' | 'email'>('password')
const passwordChanged = ref(false)
// 绑邮箱阶段发码失败后，允许「跳过」（应对邮件服务未配置/异常的情况）
const bindSendFailed = ref(false)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function startCooldown(refVar: { value: number }, secs = 60) {
  refVar.value = secs
  const t = setInterval(() => {
    refVar.value--
    if (refVar.value <= 0) clearInterval(t)
  }, 1000)
  return t
}
let timers: ReturnType<typeof setInterval>[] = []
onBeforeUnmount(() => timers.forEach((t) => clearInterval(t)))
function track(t: ReturnType<typeof setInterval>) { timers.push(t); return t }

// ===== 修改密码 =====
const verifyMethod = ref<'code' | 'current'>('current')
// 仅当已绑邮箱时才允许用「邮箱验证码」验证身份
const showCodeMethod = computed(() => emailBound.value)
const currentPwd = ref('')
const secCode = ref('')
const secSending = ref(false)
const secCooldown = ref(0)
const newPwd = ref('')
const confirmPwd = ref('')
const changing = ref(false)

const canSendSec = computed(() => secCooldown.value === 0 && !secSending.value)

async function sendSecCode() {
  if (!canSendSec.value) return
  secSending.value = true
  try {
    const res = await $fetch(`${base.value}/security/send-code`, {
      method: 'POST',
      credentials: 'include',
    })
    toast.success(res.message || '验证码已发送')
    track(startCooldown(secCooldown))
  } catch (err: any) {
    const msg = err.data?.message || err.data?.statusMessage || '发送失败'
    toast.error(msg)
    if (err.data?.code === 'MAIL_NOT_CONFIGURED') bindSendFailed.value = true
    if (err.data?.remainingMs) track(startCooldown(secCooldown, Math.ceil(err.data.remainingMs / 1000)))
  } finally {
    secSending.value = false
  }
}

async function submitChange() {
  if (!newPwd.value || newPwd.value.length < 6) {
    toast.error('新密码长度至少 6 位')
    return
  }
  if (newPwd.value !== confirmPwd.value) {
    toast.error('两次输入的新密码不一致')
    return
  }
  if (verifyMethod.value === 'current' && !currentPwd.value) {
    toast.error('请输入当前密码')
    return
  }
  if (verifyMethod.value === 'code' && !secCode.value.trim()) {
    toast.error('请输入邮箱验证码')
    return
  }

  changing.value = true
  try {
    const body: Record<string, string> = { newPassword: newPwd.value }
    if (verifyMethod.value === 'current') {
      body.currentPassword = currentPwd.value
    } else {
      body.emailCode = secCode.value.trim()
    }
    await $fetch(`${base.value}/me`, {
      method: 'PATCH',
      credentials: 'include',
      body,
    })
    passwordChanged.value = true
    newPwd.value = ''
    confirmPwd.value = ''
    currentPwd.value = ''
    secCode.value = ''
    toast.success('密码修改成功')

    // 已绑邮箱 → 直接完成；未配置邮件服务 → 跳过绑定；否则进入绑邮箱步骤
    if (emailBound.value || !emailConfigured.value) {
      emit('done')
      return
    }
    step.value = 'email'
  } catch (err: any) {
    toast.error(err.data?.message || err.data?.statusMessage || '修改失败')
  } finally {
    changing.value = false
  }
}

// ===== 绑定邮箱 =====
const bindEmail = ref(props.initialEmail || '')
const bindCode = ref('')
const bindSending = ref(false)
const bindVerifying = ref(false)
const bindCooldown = ref(0)

const canSendBind = computed(
  () => EMAIL_RE.test(bindEmail.value.trim()) && bindCooldown.value === 0 && !bindSending.value,
)

async function sendBindCode() {
  if (!canSendBind.value) return
  bindSending.value = true
  try {
    const res = await $fetch(`${base.value}/bind-email/send-code`, {
      method: 'POST',
      credentials: 'include',
      body: { email: bindEmail.value.trim().toLowerCase() },
    })
    toast.success(res.message || '验证码已发送')
    track(startCooldown(bindCooldown))
  } catch (err: any) {
    const msg = err.data?.message || err.data?.statusMessage || '发送失败'
    toast.error(msg)
    if (err.data?.code === 'MAIL_NOT_CONFIGURED') bindSendFailed.value = true
    if (err.data?.remainingMs) track(startCooldown(bindCooldown, Math.ceil(err.data.remainingMs / 1000)))
  } finally {
    bindSending.value = false
  }
}

async function verifyBind() {
  if (!bindEmail.value.trim() || !bindCode.value.trim()) {
    toast.error('请填写邮箱与验证码')
    return
  }
  bindVerifying.value = true
  try {
    const res = await $fetch(`${base.value}/bind-email/verify`, {
      method: 'POST',
      credentials: 'include',
      body: { email: bindEmail.value.trim().toLowerCase(), code: bindCode.value.trim() },
    })
    toast.success(res.message || '邮箱绑定成功')
    emailBound.value = true
    bindCode.value = ''
    emit('done')
  } catch (err: any) {
    toast.error(err.data?.message || err.data?.statusMessage || '绑定失败')
  } finally {
    bindVerifying.value = false
  }
}

// 跳过绑邮箱：仅在「未配置邮件服务」或「发码失败」时开放，避免无 SMTP 时死锁
const canSkipEmail = computed(() => !emailConfigured.value || bindSendFailed.value)
function skipEmail() {
  if (emailConfigured.value) {
    toast.warning('建议绑定邮箱以增强账号安全，您仍可选择稍后绑定')
  }
  emit('done')
}

const roleLabel = computed(() => (props.role === 'admin' ? '管理员' : '学生'))

// 密码步骤说明文案
const passwordHint = computed(() => {
  if (emailBound.value) return '为保障账号安全，请修改您的初始/默认密码后再继续使用系统。'
  if (emailConfigured.value) return '请先修改初始密码，修改完成后需绑定邮箱以完成安全设置。'
  return '请修改您的初始/默认密码以继续使用系统（当前系统未配置邮件服务，邮箱可稍后绑定）。'
})
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070b14] overflow-y-auto"
    :class="force ? '' : 'bg-black/60 backdrop-blur-sm'"
  >
    <div class="w-full max-w-md my-auto">
      <div class="glass-card p-8">
        <!-- 标题 -->
        <div class="mb-6 text-center">
          <div class="inline-flex w-14 h-14 rounded-2xl bg-brand-500/10 items-center justify-center mb-4">
            <MorphIcon :icon="Shield" :size="28" class="text-brand-400" />
          </div>
          <h1 class="text-xl font-bold text-slate-100">账号安全设置</h1>
          <p class="text-sm text-slate-500 mt-1">
            为保障账号安全，请完成安全设置（{{ roleLabel }}）
          </p>
        </div>

        <!-- 步骤一：修改密码（始终可用，不依赖邮箱） -->
        <div v-if="step === 'password'" class="space-y-5">
          <div
            class="px-4 py-3 rounded-lg text-sm flex items-start gap-2 bg-brand-500/10 border border-brand-500/20 text-brand-300"
          >
            <MorphIcon :icon="KeyRound" :size="15" class="shrink-0 mt-0.5" />
            <span>{{ passwordHint }}</span>
          </div>

          <!-- 验证方式切换（仅已绑邮箱时显示「邮箱验证码」） -->
          <div v-if="showCodeMethod" class="flex bg-slate-800/40 rounded-lg p-1">
            <button
              type="button"
              @click="verifyMethod = 'current'"
              class="flex-1 py-2 rounded-md text-sm font-medium transition-all duration-200"
              :class="verifyMethod === 'current' ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/25' : 'text-slate-400 hover:text-slate-200'"
            >
              <MorphIcon :icon="Lock" :size="14" class="inline" /> 当前密码
            </button>
            <button
              type="button"
              @click="verifyMethod = 'code'"
              class="flex-1 py-2 rounded-md text-sm font-medium transition-all duration-200"
              :class="verifyMethod === 'code' ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/25' : 'text-slate-400 hover:text-slate-200'"
            >
              <MorphIcon :icon="Mail" :size="14" class="inline" /> 邮箱验证码
            </button>
          </div>

          <!-- 当前密码验证 -->
          <div v-if="verifyMethod === 'current'">
            <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">当前密码</label>
            <input
              v-model="currentPwd"
              type="password"
              :placeholder="emailBound ? '请输入当前密码' : '请输入您的初始/默认密码'"
              class="form-input"
              :disabled="changing"
              @keyup.enter="submitChange"
            />
          </div>

          <!-- 邮箱验证码验证 -->
          <div v-else>
            <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">邮箱验证码</label>
            <div class="flex gap-2">
              <input
                v-model="secCode"
                type="text"
                inputmode="numeric"
                placeholder="6 位验证码"
                class="form-input flex-1"
                :disabled="changing"
                @keyup.enter="submitChange"
              />
              <button
                type="button"
                :disabled="!canSendSec"
                @click="sendSecCode"
                class="btn btn-ghost text-sm whitespace-nowrap min-w-[104px]"
              >
                <span v-if="secCooldown > 0" class="tabular-nums">{{ secCooldown }} 秒后重发</span>
                <span v-else-if="secSending" class="flex items-center gap-1.5">
                  <MorphIcon :icon="RefreshCw" :size="14" class="animate-spin" /> 发送中
                </span>
                <span v-else class="flex items-center gap-1.5"><MorphIcon :icon="Send" :size="14" /> 获取验证码</span>
              </button>
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">新密码</label>
            <input
              v-model="newPwd"
              type="password"
              placeholder="至少 6 位"
              class="form-input"
              :disabled="changing"
              @keyup.enter="submitChange"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">确认新密码</label>
            <input
              v-model="confirmPwd"
              type="password"
              placeholder="再次输入新密码"
              class="form-input"
              :disabled="changing"
              @keyup.enter="submitChange"
            />
          </div>

          <button
            type="button"
            :disabled="changing"
            @click="submitChange"
            class="btn btn-primary w-full py-3"
          >
            <span v-if="changing" class="flex items-center gap-2">
              <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              提交中...
            </span>
            <span v-else class="flex items-center gap-1.5">
              <MorphIcon :icon="KeyRound" :size="16" /> 确认修改并继续
            </span>
          </button>
        </div>

        <!-- 步骤二：绑定邮箱（按需，可跳过） -->
        <div v-else class="space-y-5">
          <div
            class="px-4 py-3 rounded-lg text-sm flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-400"
          >
            <MorphIcon :icon="AlertTriangle" :size="15" class="shrink-0 mt-0.5" />
            <span>
              请绑定邮箱以完成安全设置
              <template v-if="!emailConfigured">（系统当前未配置邮件服务，您可稍后绑定）</template>
            </span>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">电子邮箱</label>
            <input
              v-model="bindEmail"
              type="email"
              placeholder="请输入您的邮箱"
              class="form-input"
              :disabled="bindVerifying"
              @keyup.enter="sendBindCode"
            />
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">验证码</label>
            <div class="flex gap-2">
              <input
                v-model="bindCode"
                type="text"
                inputmode="numeric"
                placeholder="6 位验证码"
                class="form-input flex-1"
                :disabled="bindVerifying"
                @keyup.enter="verifyBind"
              />
              <button
                type="button"
                :disabled="!canSendBind"
                @click="sendBindCode"
                class="btn btn-ghost text-sm whitespace-nowrap min-w-[104px]"
              >
                <span v-if="bindCooldown > 0" class="tabular-nums">{{ bindCooldown }} 秒后重发</span>
                <span v-else-if="bindSending" class="flex items-center gap-1.5">
                  <MorphIcon :icon="RefreshCw" :size="14" class="animate-spin" /> 发送中
                </span>
                <span v-else class="flex items-center gap-1.5"><MorphIcon :icon="Send" :size="14" /> 获取验证码</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            :disabled="bindVerifying"
            @click="verifyBind"
            class="btn btn-primary w-full py-3"
          >
            <span v-if="bindVerifying" class="flex items-center gap-2">
              <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              绑定中...
            </span>
            <span v-else class="flex items-center gap-1.5"><MorphIcon :icon="Check" :size="16" /> 完成绑定</span>
          </button>

          <!-- 仅在未配置邮件服务 / 发码失败时才允许跳过，避免无 SMTP 时死锁 -->
          <button
            v-if="canSkipEmail"
            type="button"
            :disabled="bindVerifying"
            @click="skipEmail"
            class="w-full text-sm text-slate-500 hover:text-slate-300 py-1 transition-colors"
          >
            跳过，稍后绑定
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
