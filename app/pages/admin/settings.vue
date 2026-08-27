<script setup lang="ts">
import type { SystemSetting } from '~/types'

definePageMeta({ auth: true })

const toast = useToast()
const { data: authData } = useFetch('/api/auth/me', {
  credentials: 'include', server: false, default: () => ({ success: false, admin: null }),
})
const currentUser = computed(() => authData.value?.admin || null)

const settings = ref<SystemSetting[]>([])
const loading = ref(true)
const saving = ref<number | null>(null)

// 仅班级相关设置
const classKeys = ['system_title', 'nav_title', 'show_ranking', 'show_search', 'enable_user_detail', 'show_statistics']

watchEffect(async () => {
  if (!currentUser.value) return
  try {
    const data = await $fetch('/api/settings')
    const allSettings = Array.isArray(data) ? data : (data.data || [])
    settings.value = allSettings.filter((s: SystemSetting) => classKeys.includes(s.settingKey))
  } catch (err) { toast.error('加载设置失败') }
  finally { loading.value = false }
})

async function updateSetting(s: SystemSetting) {
  saving.value = s.id
  try {
    await $fetch(`/api/settings/${s.id}`, { method: 'PATCH', body: { settingValue: s.settingValue } })
    await refreshNuxtData('public-settings')
    toast.success('已保存')
  } catch (err) { toast.error(err.data?.message || '保存失败') }
  finally { saving.value = null }
}

const keyLabels: Record<string, string> = {
  system_title: '系统标题',
  nav_title: '导航栏标题',
  show_ranking: '显示排行榜',
  show_search: '显示搜索',
  enable_user_detail: '启用用户详情',
  show_statistics: '显示统计',
}

const roleLabel = computed(() => {
  const r = currentUser.value?.role
  if (r === 'super_admin') return '超级管理员'
  if (r === 'school_admin') return '学校管理员'
  if (r === 'grade_admin') return '年级管理员'
  if (r === 'class_admin') return '班级管理员'
  return r
})

const belongInfo = computed(() => {
  const u = currentUser.value
  if (!u) return ''
  if (u.classId && u.className) {
    return `${u.gradeName ? u.gradeName + ' - ' : ''}${u.className}`
  }
  if (u.gradeId && u.gradeName) {
    return u.gradeName
  }
  if (u.schoolId && u.schoolName) {
    return u.schoolName
  }
  if (u.role === 'super_admin') return '系统全局'
  return ''
})
</script>

<template>
  <div>
    <section class="border-b border-slate-800/50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h1 class="text-xl font-bold text-slate-100 mb-1">个人设置</h1>
        <p class="text-sm text-slate-500">{{ belongInfo ? `${belongInfo} · ${roleLabel}` : '管理班级/年级相关的显示配置' }}</p>
      </div>
    </section>

    <!-- 管理员信息 -->
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <div class="glass-card p-4 animate-slide-up">
        <div class="flex items-center gap-6 flex-wrap text-sm">
          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-500">账号</span>
            <span class="text-slate-200 font-medium">{{ currentUser?.username || '...' }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-500">角色</span>
            <span class="text-slate-200">{{ roleLabel }}</span>
          </div>
          <div v-if="belongInfo" class="flex items-center gap-2">
            <span class="text-xs text-slate-500">所属</span>
            <span class="text-slate-200">{{ belongInfo }}</span>
          </div>
        </div>
      </div>
    </section>

    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="glass-card p-6 animate-slide-up">
        <div v-if="loading" class="space-y-3">
          <div v-for="i in 4" :key="i" class="flex items-center gap-4 p-3 animate-pulse">
            <div class="w-32 h-3 rounded bg-slate-800"></div>
            <div class="flex-1 h-8 rounded bg-slate-800"></div>
          </div>
        </div>
        <div v-else class="space-y-3">
          <div v-for="s in settings" :key="s.id" class="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-800/20 transition-all">
            <span class="text-sm font-medium text-slate-300 w-36 flex-shrink-0">
              {{ keyLabels[s.settingKey] || s.settingKey }}
            </span>
            <div class="flex-1 flex items-center gap-2">
              <template v-if="s.settingKey === 'show_ranking' || s.settingKey === 'show_search' || s.settingKey === 'enable_user_detail' || s.settingKey === 'show_statistics'">
                <select
                  :value="s.settingValue"
                  @change="s.settingValue = ($event.target as HTMLSelectElement).value; updateSetting(s)"
                  class="form-input text-sm py-1.5 w-36"
                  :disabled="saving === s.id"
                >
                  <option value="1">开启</option>
                  <option value="0">关闭</option>
                </select>
              </template>
              <template v-else>
                <input v-model="s.settingValue" @blur="updateSetting(s)" type="text" class="form-input text-sm py-1.5" :disabled="saving === s.id" />
              </template>
              <span v-if="saving === s.id" class="text-xs text-brand-400">保存中...</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

