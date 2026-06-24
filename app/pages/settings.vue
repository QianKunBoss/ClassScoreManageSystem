<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useToast } from '~/composables/useToast'
import { onBeforeRouteLeave } from 'vue-router'

const toast = useToast()

// 当前用户信息
const { data: authData, refresh: refreshAuth } = useFetch('/api/auth/me', {
  credentials: 'include',
  server: false,
  immediate: true,
})

const currentUser = computed(() => authData.value?.admin || null)
const mustChange = computed(() => currentUser.value?.mustChangePassword === 1)

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
    toast.error(err.data?.statusMessage || '修改失败')
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
    toast.error(err.data?.statusMessage || '修改失败')
  } finally {
    pwdLoading.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
    <!-- 强制改密提示 -->
    <div
      v-if="forceMode"
      class="glass-card p-6 mb-8 border-amber-500/30 bg-amber-500/5"
    >
      <div class="flex items-center gap-3 mb-2">
        <span class="text-2xl">⚠️</span>
        <h2 class="text-lg font-bold text-amber-400">请先修改密码</h2>
      </div>
      <p class="text-sm text-slate-400 leading-relaxed">
        您使用的是初始密码，为了账号安全，请先设置新密码再继续使用系统。<br />
        <span class="text-amber-400/80">新密码不能与初始密码相同。</span>
      </p>
    </div>

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
  </div>
</template>

