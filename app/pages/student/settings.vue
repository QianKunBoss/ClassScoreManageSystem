<script setup lang="ts">
definePageMeta({ middleware: 'student', layout: 'student' })

const toast = useToast()

// 学生信息
const { data: meData, refresh: refreshMe } = useFetch('/api/auth/student/me', {
  credentials: 'include',
  server: false,
  immediate: true,
})

const student = computed(() => meData.value?.student || null)

// 修改用户名（内部对话框）
const editingUsername = ref(false)
const usernameInput = ref('')
const usernameLoading = ref(false)
// 密码确认弹窗
const showPwdConfirm = ref(false)
const confirmPwdInput = ref('')
const pendingUsername = ref('')

function startEditUsername() {
  usernameInput.value = student.value?.username || ''
  editingUsername.value = true
}

function requestSaveUsername() {
  const trimmed = usernameInput.value.trim()
  if (!trimmed) {
    toast.error('请输入用户名')
    return
  }
  pendingUsername.value = trimmed
  confirmPwdInput.value = ''
  showPwdConfirm.value = true
}

async function saveUsername() {
  if (!confirmPwdInput.value) {
    toast.error('请输入当前密码')
    return
  }
  showPwdConfirm.value = false
  usernameLoading.value = true
  try {
    await $fetch('/api/auth/student/me', {
      method: 'PATCH',
      credentials: 'include',
      body: {
        username: pendingUsername.value,
        currentPassword: confirmPwdInput.value,
      },
    })
    toast.success('用户名已更新')
    editingUsername.value = false
    refreshMe()
  } catch (err: any) {
    toast.error(err.data?.statusMessage || err.data?.message || '修改失败')
  } finally {
    usernameLoading.value = false
    confirmPwdInput.value = ''
  }
}

// 修改真实姓名
const editingName = ref(false)
const nameInput = ref('')
const nameLoading = ref(false)

function startEditName() {
  nameInput.value = student.value?.actualName || ''
  editingName.value = true
}

async function saveName() {
  const trimmed = nameInput.value.trim()
  if (!trimmed) {
    toast.error('请输入姓名')
    return
  }
  nameLoading.value = true
  try {
    await $fetch('/api/auth/student/me', {
      method: 'PATCH',
      credentials: 'include',
      body: {
        actualName: trimmed,
      },
    })
    toast.success('姓名已更新')
    editingName.value = false
    refreshMe()
  } catch (err: any) {
    toast.error(err.data?.statusMessage || '修改失败')
  } finally {
    nameLoading.value = false
  }
}

// 修改密码
const currentPwd = ref('')
const newPwd = ref('')
const confirmPwd = ref('')
const pwdLoading = ref(false)

async function updatePassword() {
  if (!currentPwd.value) {
    toast.error('请输入当前密码')
    return
  }
  if (!newPwd.value || newPwd.value.length < 6) {
    toast.error('新密码长度至少6位')
    return
  }
  if (newPwd.value !== confirmPwd.value) {
    toast.error('两次输入的新密码不一致')
    return
  }
  pwdLoading.value = true
  try {
    await $fetch('/api/auth/student/me', {
      method: 'PATCH',
      credentials: 'include',
      body: {
        currentPassword: currentPwd.value,
        newPassword: newPwd.value,
      },
    })
    toast.success('密码已更新')
    currentPwd.value = ''
    newPwd.value = ''
    confirmPwd.value = ''
  } catch (err: any) {
    toast.error(err.data?.statusMessage || '修改失败')
  } finally {
    pwdLoading.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
    <div v-if="!student" class="text-center py-20 text-slate-500">
      正在加载用户信息...
    </div>

    <template v-else>
      <h1 class="text-2xl font-bold text-slate-100 mb-8">个人设置</h1>

      <div class="space-y-8">
        <!-- 账号信息 -->
        <div class="glass-card p-6">
          <h2 class="text-sm font-bold text-slate-100 mb-4">账号信息</h2>
          <div class="space-y-3">
            <div class="flex justify-between items-center">
              <span class="text-sm text-slate-500">学号/用户名</span>
              <div v-if="editingUsername" class="flex items-center gap-2">
                <input
                  v-model="usernameInput"
                  type="text"
                  placeholder="请输入用户名"
                  class="form-input text-sm w-32"
                  @keyup.enter="requestSaveUsername"
                />
                <button class="btn btn-primary text-xs py-1" :disabled="usernameLoading" @click="requestSaveUsername">保存</button>
                <button class="btn btn-ghost text-xs py-1" @click="editingUsername = false">取消</button>
              </div>
              <div v-else class="flex items-center gap-2">
                <span class="text-sm text-slate-200 font-medium">{{ student.username }}</span>
                <button class="btn btn-ghost text-xs py-0.5 px-2" @click="startEditUsername">修改</button>
              </div>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-slate-500">真实姓名</span>
              <div v-if="editingName" class="flex items-center gap-2">
                <input
                  v-model="nameInput"
                  type="text"
                  placeholder="请输入真实姓名"
                  class="form-input text-sm w-32"
                  @keyup.enter="saveName"
                />
                <button class="btn btn-primary text-xs py-1" :disabled="nameLoading" @click="saveName">保存</button>
                <button class="btn btn-ghost text-xs py-1" @click="editingName = false">取消</button>
              </div>
              <div v-else class="flex items-center gap-2">
                <span class="text-sm text-slate-200 font-medium">{{ student.actualName || '-' }}</span>
                <button class="btn btn-ghost text-xs py-0.5 px-2" @click="startEditName">修改</button>
              </div>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-slate-500">当前积分</span>
              <span class="text-sm text-indigo-400 font-bold">{{ student.totalScore ?? 0 }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-slate-500">所属班级</span>
              <span class="text-sm text-slate-200 font-medium">
                {{ [student.gradeName, student.className].filter(Boolean).join(' - ') || '-' }}
              </span>
            </div>
          </div>
        </div>

        <!-- 修改密码 -->
        <div class="glass-card p-6">
          <h2 class="text-sm font-bold text-slate-100 mb-4">修改密码</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">当前密码</label>
              <input
                v-model="currentPwd"
                type="password"
                placeholder="请输入当前密码"
                class="form-input w-full"
              />
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">新密码</label>
              <input
                v-model="newPwd"
                type="password"
                placeholder="至少6位"
                class="form-input w-full"
              />
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">确认新密码</label>
              <input
                v-model="confirmPwd"
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

  <!-- 修改用户名密码确认弹窗 -->
  <UiConfirm
    :show="showPwdConfirm"
    title="验证当前密码"
    confirm-text="确认修改"
    @confirm="saveUsername"
    @cancel="showPwdConfirm = false"
  >
    <template #extra>
      <div class="mt-3">
        <label class="block text-xs text-slate-500 mb-1.5">当前密码</label>
        <input
          v-model="confirmPwdInput"
          type="password"
          placeholder="请输入当前密码以验证身份"
          class="form-input w-full"
          @keyup.enter="saveUsername"
        />
      </div>
    </template>
  </UiConfirm>
</template>
