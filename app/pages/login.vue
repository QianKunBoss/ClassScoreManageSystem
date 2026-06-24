<script setup lang="ts">
definePageMeta({ auth: false, layout: 'blank' })

const loginMode = ref<'admin' | 'student'>('admin') // 'admin' | 'student'
const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const selectedSchoolId = ref<string>('')
const schools = ref<{ id: number; name: string }[]>([])
const schoolsLoading = ref(true)

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
      // 管理员登录
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
        await navigateTo('/student')
      }
    }
  } catch (err) {
    const e = err as any
    error.value = e.data?.message || '登录失败，请重试'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="w-full max-w-md px-4">
    <!-- 背景光效 -->
    <div class="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl"></div>
      <div class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl"></div>
    </div>

    <div class="animate-fade-in">
      <!-- Logo -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-2xl shadow-2xl shadow-indigo-500/25 mb-4">
          C
        </div>
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
            :class="loginMode === 'admin' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'text-slate-400 hover:text-slate-200'"
          >
            🔐 管理员
          </button>
          <button
            @click="loginMode = 'student'"
            class="flex-1 py-2 rounded-md text-sm font-medium transition-all duration-200"
            :class="loginMode === 'student' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'text-slate-400 hover:text-slate-200'"
          >
            🎓 学生
          </button>
        </div>

        <form @submit.prevent="handleLogin" class="space-y-5">
          <!-- 学校选择（学生登录必选，管理员可选） -->
          <div>
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
                🏫 {{ school.name }}
              </option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
              {{ loginMode === 'admin' ? '用户名' : '学号/用户名' }}
            </label>
            <input
              v-model="username"
              type="text"
              :placeholder="loginMode === 'admin' ? '请输入用户名' : '请输入学号或用户名'"
              class="form-input"
              :disabled="loading"
              @keyup.enter="handleLogin"
            />
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">密码</label>
            <input
              v-model="password"
              type="password"
              placeholder="请输入密码"
              class="form-input"
              :disabled="loading"
              @keyup.enter="handleLogin"
            />
          </div>

          <div
            v-if="error"
            class="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2"
          >
            <span>⚠</span> {{ error }}
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
            <span v-else>{{ loginMode === 'admin' ? '登录' : '学生登录' }}</span>
          </button>
        </form>

        <div class="mt-6 pt-5 border-t border-slate-700/50 text-center">
          <p v-if="loginMode === 'admin'" class="text-xs text-slate-500">
            还没有账号？<NuxtLink to="/apply" class="text-indigo-400 hover:text-indigo-300 transition-colors">点此申请入驻</NuxtLink>
          </p>
          <p v-else class="text-xs text-slate-500">
            学生账号由管理员创建，请联系管理员获取登录信息
          </p>
        </div>
        <div class="mt-3 text-center">
          <p class="text-center text-xs text-slate-600">
            CSMS v0.3.0 &middot; Nuxt 4 + SQLite
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
