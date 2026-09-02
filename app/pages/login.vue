<script setup lang="ts">
import { Lock, GraduationCap, AlertTriangle, KeyRound, Mail, Send, Check, RefreshCw } from '~/utils/icons'
definePageMeta({ auth: false, layout: 'blank' })

const loginMode = ref<'admin' | 'student'>('admin') // 'admin' | 'student'
const adminLoginMethod = ref<'password' | 'emailCode'>('password') // 管理员登录方式
const username = ref('')
const password = ref('')
const emailCode = ref('')
const emailCodeSent = ref(false)
const emailCodeCooldown = ref(0)
const emailCodeMsg = ref('')
const emailCodeMsgType = ref<'info' | 'error'>('info')
let emailCodeTimer: ReturnType<typeof setInterval> | null = null
const loading = ref(false)
const error = ref('')
const selectedSchoolId = ref<string>('')
const schools = ref<{ id: number; name: string }[]>([])
const schoolsLoading = ref(true)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// 加载学校列表
onMounted(async () => {
  try {
    const data = await $fetch('/api/schools')
    if (data.success) {
      schools.value = data.data
    }
  } catch (err) {
    console.warn('加载学校列表失败', err)
  } finally {
    schoolsLoading.value = false
  }
})

function startEmailCodeCooldown(secs = 60) {
  emailCodeCooldown.value = secs
  if (emailCodeTimer) clearInterval(emailCodeTimer)
  emailCodeTimer = setInterval(() => {
    emailCodeCooldown.value--
    if (emailCodeCooldown.value <= 0 && emailCodeTimer) {
      clearInterval(emailCodeTimer)
      emailCodeTimer = null
    }
  }, 1000)
}

function toggleAdminLoginMethod() {
  adminLoginMethod.value = adminLoginMethod.value === 'password' ? 'emailCode' : 'password'
  error.value = ''
  emailCodeMsg.value = ''
  emailCode.value = ''
}

async function sendAdminEmailCode() {
  if (!EMAIL_RE.test(username.value.trim())) {
    emailCodeMsg.value = '请先输入有效的邮箱地址'
    emailCodeMsgType.value = 'error'
    return
  }
  emailCodeMsg.value = ''
  loading.value = true
  try {
    const res = await $fetch('/api/auth/admin/email-code/send', {
      method: 'POST',
      body: { email: username.value.trim() },
    })
    emailCodeMsg.value = res.message || '验证码已发送'
    emailCodeMsgType.value = 'info'
    emailCodeSent.value = true
    startEmailCodeCooldown()
  } catch (err: any) {
    emailCodeMsg.value = err.data?.message || '发送失败'
    emailCodeMsgType.value = 'error'
  } finally {
    loading.value = false
  }
}

async function handleLogin() {
  if (!selectedSchoolId.value && loginMode.value === 'student') {
    error.value = '请先选择学校'
    return
  }
  if (!username.value || !password.value) {
    error.value = '请输入用户名和密码'
    return
  }
  loading.value = true
  error.value = ''

  try {
    if (loginMode.value === 'admin') {
      // 管理员登录（用户名或邮箱均可作为标识）
      const body: any = {
        username: username.value,
        password: password.value,
      }
      if (selectedSchoolId.value && selectedSchoolId.value !== '') {
        body.schoolId = Number(selectedSchoolId.value)
      }
      const data = await $fetch('/api/auth/login', {
        method: 'POST',
        body,
        credentials: 'include',
      })
      if (data.success) {
        // 仅在使用默认/重置密码时强制进入安全设置；未绑邮箱且系统已配 SMTP 的情况
        // 由全局中间件在目标页再重定向处理，避免未配置邮件服务时把用户卡进模态框
        if (data.admin?.mustChangePassword) {
          await navigateTo('/settings?force=true')
        } else {
          await navigateTo('/admin')
        }
      }
    } else {
      // 学生登录
      const data = await $fetch('/api/auth/student/login', {
        method: 'POST',
        body: {
          schoolId: Number(selectedSchoolId.value),
          username: username.value,
          password: password.value,
        },
        credentials: 'include',
      })
      if (data.success) {
        // 仅在使用默认/重置密码时强制进入设置页；未绑邮箱且系统已配 SMTP 的情况由
        // student 中间件在目标页再重定向处理
        if (data.user?.mustChangePassword) {
          await navigateTo('/student/setup-required')
        } else {
          await navigateTo('/student')
        }
      }
    }
  } catch (err) {
    const e = err as any
    error.value = e.data?.message || '登录失败，请重试'
  } finally {
    loading.value = false
  }
}

async function handleEmailCodeLogin() {
  if (!EMAIL_RE.test(username.value.trim())) {
    error.value = '请输入有效的邮箱地址'
    return
  }
  if (!emailCode.value.trim()) {
    error.value = '请输入验证码'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const data = await $fetch('/api/auth/admin/email-code/login', {
      method: 'POST',
      body: { email: username.value.trim(), code: emailCode.value.trim() },
      credentials: 'include',
    })
    if (data.success) {
      if (data.admin?.mustChangePassword) {
        await navigateTo('/settings?force=true')
      } else {
        await navigateTo('/admin')
      }
    }
  } catch (err) {
    const e = err as any
    error.value = e.data?.message || '登录失败，请重试'
  } finally {
    loading.value = false
  }
}

function onLoginSubmit() {
  if (loginMode.value === 'admin' && adminLoginMethod.value === 'emailCode') {
    handleEmailCodeLogin()
  } else {
    handleLogin()
  }
}

// ===== 忘记密码（找回密码）=====
const showForgot = ref(false)
const forgotMode = ref<'student' | 'admin'>('student')
const forgotSchoolId = ref<string>('')
const forgotUsername = ref('')
const forgotEmail = ref('')
const forgotCode = ref('')
const forgotNewPwd = ref('')
const forgotConfirmPwd = ref('')
const forgotStep = ref<1 | 2>(1)
const forgotLoading = ref(false)
const forgotMsg = ref('')
const forgotMsgType = ref<'info' | 'error'>('info')
const forgotCooldown = ref(0)
let forgotTimer: ReturnType<typeof setInterval> | null = null

function openForgot() {
  showForgot.value = true
  forgotMode.value = loginMode.value
  forgotStep.value = 1
  forgotSchoolId.value = selectedSchoolId.value
  forgotUsername.value = ''
  forgotEmail.value = ''
  forgotCode.value = ''
  forgotNewPwd.value = ''
  forgotConfirmPwd.value = ''
  forgotMsg.value = ''
}

function closeForgot() {
  showForgot.value = false
  if (forgotTimer) { clearInterval(forgotTimer); forgotTimer = null }
  forgotCooldown.value = 0
}

async function forgotSendCode() {
  if (forgotMode.value === 'admin') {
    if (!EMAIL_RE.test(forgotEmail.value.trim())) {
      forgotMsg.value = '请输入有效的邮箱地址'
      forgotMsgType.value = 'error'
      return
    }
  } else {
    if (!forgotSchoolId.value || !forgotUsername.value.trim()) {
      forgotMsg.value = '请选择学校并填写用户名'
      forgotMsgType.value = 'error'
      return
    }
  }
  forgotLoading.value = true
  forgotMsg.value = ''
  try {
    const res = forgotMode.value === 'admin'
      ? await $fetch('/api/auth/admin/forgot/send-code', {
          method: 'POST',
          body: { email: forgotEmail.value.trim() },
        })
      : await $fetch('/api/auth/student/forgot/send-code', {
          method: 'POST',
          body: { schoolId: Number(forgotSchoolId.value), username: forgotUsername.value.trim() },
        })
    forgotMsg.value = res.message || '验证码已发送'
    forgotMsgType.value = 'info'
    forgotStep.value = 2
    startForgotCooldown()
  } catch (err: any) {
    forgotMsg.value = err.data?.message || err.data?.statusMessage || '发送失败'
    forgotMsgType.value = 'error'
  } finally {
    forgotLoading.value = false
  }
}

function startForgotCooldown(secs = 60) {
  forgotCooldown.value = secs
  if (forgotTimer) clearInterval(forgotTimer)
  forgotTimer = setInterval(() => {
    forgotCooldown.value--
    if (forgotCooldown.value <= 0 && forgotTimer) {
      clearInterval(forgotTimer)
      forgotTimer = null
    }
  }, 1000)
}

async function forgotReset() {
  if (!forgotNewPwd.value || forgotNewPwd.value.length < 6) {
    forgotMsg.value = '新密码长度至少 6 位'
    forgotMsgType.value = 'error'
    return
  }
  if (forgotNewPwd.value !== forgotConfirmPwd.value) {
    forgotMsg.value = '两次输入的新密码不一致'
    forgotMsgType.value = 'error'
    return
  }
  forgotLoading.value = true
  forgotMsg.value = ''
  try {
    const res = forgotMode.value === 'admin'
      ? await $fetch('/api/auth/admin/forgot/reset', {
          method: 'POST',
          body: {
            email: forgotEmail.value.trim(),
            code: forgotCode.value.trim(),
            newPassword: forgotNewPwd.value,
          },
        })
      : await $fetch('/api/auth/student/forgot/reset', {
          method: 'POST',
          body: {
            schoolId: Number(forgotSchoolId.value),
            username: forgotUsername.value.trim(),
            code: forgotCode.value.trim(),
            newPassword: forgotNewPwd.value,
          },
        })
    forgotMsg.value = res.message || '密码重置成功'
    forgotMsgType.value = 'info'
    setTimeout(() => {
      closeForgot()
      // 自动回填账号信息，方便登录
      if (forgotMode.value === 'admin') {
        loginMode.value = 'admin'
        adminLoginMethod.value = 'password'
        username.value = forgotEmail.value
      } else {
        loginMode.value = 'student'
        selectedSchoolId.value = forgotSchoolId.value
        username.value = forgotUsername.value
      }
    }, 1200)
  } catch (err: any) {
    forgotMsg.value = err.data?.message || err.data?.statusMessage || '重置失败'
    forgotMsgType.value = 'error'
  } finally {
    forgotLoading.value = false
  }
}
</script>

<template>
  <div class="w-full max-w-md px-4">
    <!-- 背景光效 -->
    <div class="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500/5 rounded-full blur-3xl"></div>
      <div class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-500/5 rounded-full blur-3xl"></div>
    </div>

    <div class="animate-fade-in">
      <!-- Logo -->
      <div class="text-center mb-8">
        <button
          type="button"
          class="inline-flex w-16 h-16 rounded-2xl overflow-hidden bg-brand-500 p-2 shadow-2xl shadow-brand-500/25 mb-4 cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95"
          aria-label="返回首页"
          @click="navigateTo('/')"
        >
          <img src="/favicon.ico" alt="CSMS" class="w-full h-full object-contain pointer-events-none" />
        </button>
        <h1 class="text-2xl font-bold text-slate-100 mb-1">欢迎回来</h1>
        <p class="text-sm text-slate-500">登录班级积分管理系统</p>
      </div>

      <!-- 登录卡片 -->
      <div class="glass-card p-8">
        <!-- Tab 切换 -->
        <div class="flex mb-6 bg-slate-800/40 rounded-lg p-1">
          <button
            @click="loginMode = 'admin'"
            class="flex-1 py-2 rounded-md text-sm font-medium transition-all duration-200"
            :class="loginMode === 'admin' ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/25' : 'text-slate-400 hover:text-slate-200'"
          >
            <MorphIcon :icon="Lock" :size="16" class="inline" /> 管理员
          </button>
          <button
            @click="loginMode = 'student'"
            class="flex-1 py-2 rounded-md text-sm font-medium transition-all duration-200"
            :class="loginMode === 'student' ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/25' : 'text-slate-400 hover:text-slate-200'"
          >
            <MorphIcon :icon="GraduationCap" :size="16" class="inline" /> 学生
          </button>
        </div>

        <form @submit.prevent="onLoginSubmit" class="space-y-5">
          <!-- 学校选择（学生必选，管理员密码登录可选） -->
          <div
            v-if="loginMode === 'student' || (loginMode === 'admin' && adminLoginMethod === 'password')"
          >
            <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
              所属学校 <span v-if="loginMode === 'student'" class="text-red-400">*</span>
            </label>
            <select
              v-model="selectedSchoolId"
              :disabled="schoolsLoading"
              class="form-input"
            >
              <option value="" disabled>{{ schoolsLoading ? '加载中...' : '— 请选择学校 —' }}</option>
              <option
                v-for="school in schools"
                :key="school.id"
                :value="String(school.id)"
              >
                {{ school.name }}
              </option>
            </select>
          </div>

          <!-- 账号 / 邮箱 -->
          <div>
            <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
              <template v-if="loginMode === 'admin' && adminLoginMethod === 'emailCode'">邮箱</template>
              <template v-else-if="loginMode === 'admin'">用户名 / 邮箱</template>
              <template v-else>学号 / 用户名 / 邮箱</template>
            </label>
            <input
              v-model="username"
              type="text"
              autocomplete="username"
              :placeholder="loginMode === 'admin' && adminLoginMethod === 'emailCode' ? '请输入邮箱' : (loginMode === 'admin' ? '请输入用户名或邮箱' : '请输入学号、用户名或邮箱')"
              class="form-input"
              :disabled="loading"
              @keyup.enter="onLoginSubmit"
            />
          </div>

          <!-- 密码（非邮箱验证码登录时显示） -->
          <div v-if="!(loginMode === 'admin' && adminLoginMethod === 'emailCode')">
            <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">密码</label>
            <input
              v-model="password"
              type="password"
              placeholder="请输入密码"
              class="form-input"
              :disabled="loading"
              @keyup.enter="onLoginSubmit"
            />
          </div>

          <!-- 邮箱验证码登录：验证码输入 -->
          <div v-if="loginMode === 'admin' && adminLoginMethod === 'emailCode'">
            <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">验证码</label>
            <div class="flex gap-2">
              <input
                v-model="emailCode"
                type="text"
                inputmode="numeric"
                placeholder="6 位验证码"
                class="form-input flex-1"
                :disabled="loading"
                @keyup.enter="onLoginSubmit"
              />
              <button
                type="button"
                :disabled="emailCodeCooldown > 0 || loading"
                @click="sendAdminEmailCode"
                class="btn btn-ghost text-sm whitespace-nowrap min-w-[104px]"
              >
                <span v-if="emailCodeCooldown > 0" class="tabular-nums">{{ emailCodeCooldown }} 秒后重发</span>
                <span v-else class="flex items-center gap-1.5"><MorphIcon :icon="Send" :size="14" /> 获取验证码</span>
              </button>
            </div>
          </div>

          <!-- 邮箱验证码提示 -->
          <div
            v-if="loginMode === 'admin' && adminLoginMethod === 'emailCode' && emailCodeMsg"
            class="px-4 py-3 rounded-lg text-sm flex items-center gap-2"
            :class="emailCodeMsgType === 'error' ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-brand-500/10 border border-brand-500/20 text-brand-300'"
          >
            <MorphIcon :icon="emailCodeMsgType === 'error' ? AlertTriangle : Check" :size="15" class="shrink-0" /> {{ emailCodeMsg }}
          </div>

          <div
            v-if="error"
            class="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2"
          >
            <MorphIcon :icon="AlertTriangle" :size="16" class="shrink-0" /> {{ error }}
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="btn btn-primary w-full py-3"
          >
            <span v-if="loading" class="flex items-center gap-2">
              <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              登录中...
            </span>
            <span v-else>
              <template v-if="loginMode === 'admin' && adminLoginMethod === 'emailCode'">验证码登录</template>
              <template v-else-if="loginMode === 'admin'">登录</template>
              <template v-else>学生登录</template>
            </span>
          </button>
        </form>

        <div class="mt-6 pt-5 border-t border-slate-700/50 text-center space-y-2">
          <!-- 管理员：登录方式切换 -->
          <button
            v-if="loginMode === 'admin'"
            type="button"
            @click="toggleAdminLoginMethod"
            class="text-xs text-brand-400 hover:text-brand-300 transition-colors"
          >
            {{ adminLoginMethod === 'password' ? '使用邮箱验证码登录' : '使用账号密码登录' }}
          </button>

          <p v-if="loginMode === 'admin'" class="text-xs text-slate-500">
            还没有账号？<NuxtLink to="/apply" class="text-brand-400 hover:text-brand-300 transition-colors">点此申请入驻</NuxtLink>
          </p>
          <p v-else class="text-xs text-slate-500">
            学生账号由管理员创建，请联系管理员获取登录信息
          </p>
          <button
            v-if="loginMode === 'admin' || loginMode === 'student'"
            type="button"
            @click="openForgot"
            class="text-xs text-brand-400 hover:text-brand-300 transition-colors"
          >
            忘记密码？
          </button>
        </div>
        <div class="mt-3 text-center">
          <p class="text-center text-xs text-slate-600">
            CSMS v0.3.0 &middot; Nuxt 4 + SQLite
          </p>
        </div>
      </div>
    </div>

    <!-- 忘记密码弹窗 -->
    <Transition name="fade-scale">
      <div
        v-if="showForgot"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        @click.self="closeForgot"
      >
        <div class="w-full max-w-md glass-card p-7">
          <div class="flex items-center justify-between mb-5">
            <h2 class="text-lg font-bold text-slate-100 flex items-center gap-2">
              <MorphIcon :icon="KeyRound" :size="18" class="text-brand-400" /> 找回密码
            </h2>
            <button @click="closeForgot" class="text-slate-500 hover:text-slate-300 transition-colors">
              <MorphIcon name="x" :size="18" />
            </button>
          </div>

          <!-- 步骤 1：填写身份 -->
          <div v-if="forgotStep === 1" class="space-y-4">
            <p class="text-xs text-slate-500">通过已绑定的邮箱接收验证码，验证身份后重置密码。</p>

            <!-- 管理员：邮箱 -->
            <div v-if="forgotMode === 'admin'">
              <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">邮箱</label>
              <input v-model="forgotEmail" type="email" placeholder="请输入绑定的邮箱" class="form-input" @keyup.enter="forgotSendCode" />
            </div>

            <!-- 学生：学校 + 用户名 -->
            <template v-else>
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">所属学校</label>
                <select v-model="forgotSchoolId" :disabled="schoolsLoading" class="form-input">
                  <option value="" disabled>{{ schoolsLoading ? '加载中...' : '— 请选择学校 —' }}</option>
                  <option v-for="s in schools" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">学号 / 用户名 / 邮箱</label>
                <input v-model="forgotUsername" type="text" placeholder="请输入学号、用户名或邮箱" class="form-input" @keyup.enter="forgotSendCode" />
              </div>
            </template>
          </div>

          <!-- 步骤 2：验证码 + 新密码 -->
          <div v-else class="space-y-4">
            <p class="text-xs text-slate-500">
              验证码已发送至
              <span class="text-brand-300">{{ forgotMode === 'admin' ? forgotEmail : forgotUsername }}</span>
              的绑定邮箱，请查收。
            </p>
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">验证码</label>
              <div class="flex gap-2">
                <input v-model="forgotCode" type="text" inputmode="numeric" placeholder="6 位验证码" class="form-input flex-1" @keyup.enter="forgotReset" />
                <button type="button" :disabled="forgotCooldown > 0" @click="forgotSendCode" class="btn btn-ghost text-sm whitespace-nowrap min-w-[104px]">
                  <span v-if="forgotCooldown > 0" class="tabular-nums">{{ forgotCooldown }} 秒后重发</span>
                  <span v-else class="flex items-center gap-1.5"><MorphIcon :icon="Send" :size="14" /> 重新发送</span>
                </button>
              </div>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">新密码</label>
              <input v-model="forgotNewPwd" type="password" placeholder="至少 6 位" class="form-input" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">确认新密码</label>
              <input v-model="forgotConfirmPwd" type="password" placeholder="再次输入新密码" class="form-input" @keyup.enter="forgotReset" />
            </div>
          </div>

          <!-- 提示信息 -->
          <div
            v-if="forgotMsg"
            class="mt-4 px-3 py-2.5 rounded-lg text-sm flex items-start gap-2"
            :class="forgotMsgType === 'error' ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-brand-500/10 border border-brand-500/20 text-brand-300'"
          >
            <MorphIcon :icon="forgotMsgType === 'error' ? AlertTriangle : Check" :size="15" class="shrink-0 mt-0.5" />
            <span>{{ forgotMsg }}</span>
          </div>

          <!-- 操作按钮 -->
          <div class="mt-5 flex gap-3">
            <button @click="closeForgot" class="btn btn-ghost flex-1">取消</button>
            <button
              v-if="forgotStep === 1"
              :disabled="forgotLoading"
              @click="forgotSendCode"
              class="btn btn-primary flex-1"
            >
              <span v-if="forgotLoading" class="flex items-center gap-2"><MorphIcon :icon="RefreshCw" :size="14" class="animate-spin" /> 发送中...</span>
              <span v-else class="flex items-center gap-1.5"><MorphIcon :icon="Mail" :size="15" /> 发送验证码</span>
            </button>
            <button
              v-else
              :disabled="forgotLoading"
              @click="forgotReset"
              class="btn btn-primary flex-1"
            >
              <span v-if="forgotLoading" class="flex items-center gap-2"><MorphIcon :icon="RefreshCw" :size="14" class="animate-spin" /> 重置中...</span>
              <span v-else class="flex items-center gap-1.5"><MorphIcon :icon="Check" :size="15" /> 重置密码</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
