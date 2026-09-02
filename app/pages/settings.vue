<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useToast } from '~/composables/useToast'
import { onBeforeRouteLeave } from 'vue-router'
import SecuritySetup from '~/components/security/SecuritySetup.vue'
import { Send, Check, RefreshCw } from '~/utils/icons'

const toast = useToast()

// 当前用户信息
const { data: authData, refresh: refreshAuth } = useFetch('/api/auth/me', {
  credentials: 'include',
  server: false,
  immediate: true,
})

const currentUser = computed(() => authData.value?.admin || null)
// mustChangePassword 由后端以布尔形式返回（true/false），用真值判断（不能用 === 1）
const mustChange = computed(() => !!currentUser.value?.mustChangePassword)

const belongInfo = computed(() => {
  const u = currentUser.value
  if (!u) return ''
  if (u.className) {
    return `${u.gradeName ? u.gradeName + ' - ' : ''}${u.className}`
  }
  if (u.gradeName) return u.gradeName
  if (u.schoolName) return u.schoolName
  if (u.role === 'super_admin') return '系统全局'
  return ''
})

// ===== 邮箱安全：修改/绑定邮箱（复用 bind-email 接口，无需改后端） =====
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const emailFormOpen = ref(false)
const newEmail = ref('')
const emailCode = ref('')
const emailSending = ref(false)
const emailBinding = ref(false)
const emailCooldown = ref(0)
let emailCooldownTimer: ReturnType<typeof setInterval> | null = null

const canSendEmailCode = computed(
  () => EMAIL_RE.test(newEmail.value.trim()) && emailCooldown.value === 0 && !emailSending.value,
)

function startEmailCooldown(secs = 60) {
  emailCooldown.value = secs
  if (emailCooldownTimer) clearInterval(emailCooldownTimer)
  emailCooldownTimer = setInterval(() => {
    emailCooldown.value--
    if (emailCooldown.value <= 0 && emailCooldownTimer) {
      clearInterval(emailCooldownTimer)
      emailCooldownTimer = null
    }
  }, 1000)
}

async function sendEmailCode() {
  if (!canSendEmailCode.value) return
  emailSending.value = true
  try {
    const res = await $fetch('/api/auth/admin/bind-email/send-code', {
      method: 'POST',
      credentials: 'include',
      body: { email: newEmail.value.trim().toLowerCase() },
    })
    toast.success(res.message || '验证码已发送')
    startEmailCooldown()
  } catch (err: any) {
    const msg = err.data?.message || err.data?.statusMessage || '发送失败'
    toast.error(msg)
    if (err.data?.code === 'MAIL_NOT_CONFIGURED') {
      toast.error('系统尚未配置邮件服务，无法发送验证码，请先配置 SMTP 后再修改邮箱')
    }
    if (err.data?.remainingMs) startEmailCooldown(Math.ceil(err.data.remainingMs / 1000))
  } finally {
    emailSending.value = false
  }
}

async function confirmEmail() {
  if (!newEmail.value.trim() || !emailCode.value.trim()) {
    toast.error('请填写邮箱与验证码')
    return
  }
  emailBinding.value = true
  try {
    const res = await $fetch('/api/auth/admin/bind-email/verify', {
      method: 'POST',
      credentials: 'include',
      body: { email: newEmail.value.trim().toLowerCase(), code: emailCode.value.trim() },
    })
    toast.success(res.message || '邮箱已更新')
    emailFormOpen.value = false
    newEmail.value = ''
    emailCode.value = ''
    await refreshAuth()
  } catch (err: any) {
    toast.error(err.data?.message || err.data?.statusMessage || '绑定失败')
  } finally {
    emailBinding.value = false
  }
}

// 强制改密模式
const forceMode = ref(false)
onMounted(() => {
  forceMode.value = new URLSearchParams(window.location.search).get('force') === 'true'
})

// 阻止路由跳转（强制模式）
onBeforeRouteLeave((to) => {
  if (forceMode.value && mustChange.value) {
    toast.error('请先修改密码再继续使用系统')
    return false
  }
})

// 阻止浏览器关闭/刷新（强制模式）
function beforeUnloadHandler(e: BeforeUnloadEvent) {
  if (forceMode.value && mustChange.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}
onMounted(() => {
  if (forceMode.value) {
    window.addEventListener('beforeunload', beforeUnloadHandler)
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnloadHandler)
  if (emailCooldownTimer) clearInterval(emailCooldownTimer)
})

// 修改用户名
const newUsername = ref('')
const usernameCurrentPwd = ref('')
const usernameLoading = ref(false)

async function updateUsername() {
  if (!newUsername.value || newUsername.value.length < 2) {
    toast.error('用户名至少2位')
    return
  }
  if (!usernameCurrentPwd.value) {
    toast.error('请输入当前密码')
    return
  }
  usernameLoading.value = true
  try {
    await $fetch('/api/auth/me', {
      method: 'PATCH',
      credentials: 'include',
      body: { username: newUsername.value, currentPassword: usernameCurrentPwd.value },
    })
    toast.success('用户名已更新，下次登录请使用新用户名')
    newUsername.value = ''
    usernameCurrentPwd.value = ''
    // 刷新用户信息
    await refreshNuxtData()
  } catch (err) {
    toast.error(err.data?.message || err.data?.statusMessage || '修改失败')
  } finally {
    usernameLoading.value = false
  }
}

// 修改密码
const pwdCurrent = ref('')
const pwdNew = ref('')
const pwdConfirm = ref('')
const pwdLoading = ref(false)

async function updatePassword() {
  if (!pwdCurrent.value) {
    toast.error('请输入当前密码')
    return
  }
  if (!pwdNew.value || pwdNew.value.length < 6) {
    toast.error('新密码长度至少6位')
    return
  }
  if (pwdNew.value !== pwdConfirm.value) {
    toast.error('两次输入的新密码不一致')
    return
  }
  pwdLoading.value = true
  try {
    await $fetch('/api/auth/me', {
      method: 'PATCH',
      credentials: 'include',
      body: { currentPassword: pwdCurrent.value, newPassword: pwdNew.value },
    })
        toast.success('密码已更新')
        pwdCurrent.value = ''
        pwdNew.value = ''
        pwdConfirm.value = ''
        // 刷新用户信息（mustChangePassword 已清零）
        await refreshAuth()
        // 退出强制模式
        if (forceMode.value) {
          forceMode.value = false
          window.history.replaceState(null, '', '/settings')
          toast.success('密码修改成功，现在可以正常使用系统了')
        }
  } catch (err) {
    toast.error(err.data?.message || err.data?.statusMessage || '修改失败')
  } finally {
    pwdLoading.value = false
  }
}

// 强制安全设置（SecuritySetup 模态框）完成后的回调
async function onSetupDone() {
  // 刷新用户信息（mustChangePassword 已清零、email 已绑定）
  await refreshAuth()
  forceMode.value = false
  window.history.replaceState(null, '', '/settings')
  toast.success('安全设置已完成，现在可以正常使用系统了')
}
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
    <!-- 强制安全设置：渲染全屏模态框，未完成任务前不可关闭 -->
    <SecuritySetup
      v-if="forceMode"
      role="admin"
      :initial-email="currentUser?.email"
      :email-service-configured="currentUser?.emailServiceConfigured"
      force
      @done="onSetupDone"
    />

    <template v-else>
    <h1 class="text-2xl font-bold text-slate-100 mb-1">个人设置</h1>
        <p class="text-sm text-slate-500 mb-8">{{ belongInfo || '账号设置' }}</p>

    <div class="space-y-8">
      <!-- 账号信息 -->
      <div class="glass-card p-6">
        <h2 class="text-sm font-bold text-slate-100 mb-4">账号信息</h2>
        <div class="space-y-3">
          <div class="flex justify-between items-center">
            <span class="text-sm text-slate-500">用户名</span>
            <span class="text-sm text-slate-200 font-medium">{{ currentUser?.username || '-' }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm text-slate-500">角色</span>
            <span class="text-sm text-slate-200 font-medium">
              {{ { super_admin: '超级管理员', school_admin: '学校管理员', grade_admin: '年级管理员', class_admin: '班级管理员' }[currentUser?.role] || currentUser?.role }}
            </span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm text-slate-500">状态</span>
            <span
              v-if="mustChange"
              class="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400"
            >
              需要修改密码
            </span>
            <span
              v-else
              class="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400"
            >
              正常
            </span>
          </div>
          <div v-if="belongInfo" class="flex justify-between items-center">
            <span class="text-sm text-slate-500">所属</span>
            <span class="text-sm text-slate-200 font-medium">{{ belongInfo }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm text-slate-500">邮箱</span>
            <span class="text-sm text-slate-200 font-medium flex items-center gap-2">
              <MorphIcon v-if="currentUser?.email" name="mail-check" size="1em" class="text-green-400" />
              {{ currentUser?.email || '未绑定' }}
            </span>
          </div>
        </div>
      </div>

      <!-- 修改用户名 -->
      <div class="glass-card p-6">
        <h2 class="text-sm font-bold text-slate-100 mb-4">修改用户名</h2>
        <p class="text-xs text-slate-500 mb-4">修改用户名需要提供当前密码验证身份</p>
        <div class="space-y-4">
          <div>
            <label class="block text-xs text-slate-500 mb-1.5">新用户名</label>
            <input
              v-model="newUsername"
              type="text"
              placeholder="请输入新用户名"
              class="form-input w-full"
            />
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1.5">当前密码（验证身份）</label>
            <input
              v-model="usernameCurrentPwd"
              type="password"
              placeholder="请输入当前密码"
              class="form-input w-full"
            />
          </div>
          <button
            class="btn btn-primary text-sm"
            :disabled="usernameLoading"
            @click="updateUsername"
          >
            {{ usernameLoading ? '更新中...' : '更新用户名' }}
          </button>
        </div>
      </div>

      <!-- 邮箱安全 -->
      <div class="glass-card p-6">
        <h2 class="text-sm font-bold text-slate-100 mb-4">邮箱安全</h2>
        <div class="space-y-4">
          <div class="flex justify-between items-center">
            <span class="text-sm text-slate-500">绑定邮箱</span>
            <span class="text-sm text-slate-200 font-medium flex items-center gap-2">
              <MorphIcon v-if="currentUser?.email" name="mail-check" size="1em" class="text-green-400" />
              {{ currentUser?.email || '未绑定' }}
            </span>
          </div>

          <template v-if="!emailFormOpen">
            <button class="btn btn-ghost text-sm" @click="emailFormOpen = true">
              {{ currentUser?.email ? '更换邮箱' : '绑定邮箱' }}
            </button>
          </template>

          <template v-else>
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">新邮箱地址</label>
              <input
                v-model="newEmail"
                type="email"
                placeholder="请输入新邮箱"
                class="form-input w-full"
                :disabled="emailBinding"
                @keyup.enter="sendEmailCode"
              />
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">验证码</label>
              <div class="flex gap-2">
                <input
                  v-model="emailCode"
                  type="text"
                  inputmode="numeric"
                  placeholder="6 位验证码"
                  class="form-input flex-1"
                  :disabled="emailBinding"
                  @keyup.enter="confirmEmail"
                />
                <button
                  type="button"
                  :disabled="!canSendEmailCode"
                  @click="sendEmailCode"
                  class="btn btn-ghost text-sm whitespace-nowrap min-w-[104px]"
                >
                  <span v-if="emailCooldown > 0" class="tabular-nums">{{ emailCooldown }} 秒后重发</span>
                  <span v-else-if="emailSending" class="flex items-center gap-1.5">
                    <MorphIcon :icon="RefreshCw" :size="14" class="animate-spin" /> 发送中
                  </span>
                  <span v-else class="flex items-center gap-1.5"><MorphIcon :icon="Send" :size="14" /> 获取验证码</span>
                </button>
              </div>
            </div>
            <div class="flex gap-3">
              <button
                class="btn btn-primary text-sm flex-1"
                :disabled="emailBinding"
                @click="confirmEmail"
              >
                <span v-if="emailBinding" class="flex items-center gap-2">
                  <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  提交中...
                </span>
                <span v-else class="flex items-center gap-1.5"><MorphIcon :icon="Check" :size="16" /> 确认修改</span>
              </button>
              <button
                class="btn btn-ghost text-sm"
                :disabled="emailBinding"
                @click="emailFormOpen = false"
              >
                取消
              </button>
            </div>
          </template>
        </div>
      </div>

      <!-- 修改密码 -->
      <div class="glass-card p-6">
        <h2 class="text-sm font-bold text-slate-100 mb-4">修改密码</h2>
        <div class="space-y-4">
          <div>
            <label class="block text-xs text-slate-500 mb-1.5">当前密码</label>
            <input
              v-model="pwdCurrent"
              type="password"
              placeholder="请输入当前密码"
              class="form-input w-full"
            />
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1.5">新密码</label>
            <input
              v-model="pwdNew"
              type="password"
              placeholder="至少6位"
              class="form-input w-full"
            />
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1.5">确认新密码</label>
            <input
              v-model="pwdConfirm"
              type="password"
              placeholder="再次输入新密码"
              class="form-input w-full"
            />
          </div>
          <button
            class="btn btn-primary text-sm"
            :disabled="pwdLoading"
            @click="updatePassword"
          >
            {{ pwdLoading ? '更新中...' : '更新密码' }}
          </button>
        </div>
      </div>
    </div>
  </template>
  </div>
</template>

