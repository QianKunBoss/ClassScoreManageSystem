<script setup lang="ts">
import type { SystemSetting } from '~/types'

definePageMeta({ middleware: 'super-admin', layout: 'superadmin' })

const toast = useToast()

const settings = ref<SystemSetting[]>([])
const loading = ref(true)
const saving = ref<number | null>(null)

// 界面相关设置项
const uiKeys = ['system_title', 'nav_title', 'show_ranking', 'show_search', 'enable_user_detail', 'show_statistics']

watchEffect(async () => {
  if (settings.value.length) return
  try {
    const data = await $fetch('/api/settings')
    const all = Array.isArray(data) ? data : (data.data || [])
    settings.value = all.filter((s: SystemSetting) => uiKeys.includes(s.settingKey))
  } catch { toast.error('加载设置失败') }
  finally { loading.value = false }
})

async function updateSetting(s: SystemSetting) {
  saving.value = s.id
  try {
    await $fetch(`/api/settings/${s.id}`, { method: 'PATCH', body: { settingValue: s.settingValue } })
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
</script>

<template>
  <div>
    <section class="border-b border-slate-800/50">
      <div class="px-4 sm:px-6 lg:px-8 py-6">
        <h1 class="text-xl font-bold text-slate-100 mb-1">界面设置</h1>
        <p class="text-sm text-slate-500">系统标题、导航栏与前台显示开关</p>
      </div>
    </section>

    <section class="px-4 sm:px-6 lg:px-8 py-8">
      <div class="glass-card p-6">
        <div v-if="loading" class="space-y-3">
          <div v-for="i in 4" :key="i" class="h-12 rounded-lg bg-slate-800/40 animate-pulse"></div>
        </div>
        <div v-else-if="settings.length === 0" class="text-center py-10 text-sm text-slate-500">暂无可配置的界面设置项</div>
        <div v-else class="space-y-4">
          <div
            v-for="s in settings"
            :key="s.id"
            class="flex items-center justify-between gap-4 p-4 rounded-lg bg-slate-800/20"
          >
            <div class="min-w-0">
              <p class="text-sm font-medium text-slate-200">{{ keyLabels[s.settingKey] || s.settingKey }}</p>
              <p class="text-xs text-slate-500 mt-0.5 truncate">{{ s.description || s.settingKey }}</p>
            </div>
            <!-- 开关类 -->
            <label v-if="s.settingValue === '1' || s.settingValue === '0'" class="flex items-center gap-2 shrink-0 cursor-pointer">
              <input
                type="checkbox"
                :checked="s.settingValue === '1'"
                class="accent-brand-500 w-4 h-4"
                @change="s.settingValue = ($event.target as HTMLInputElement).checked ? '1' : '0'; updateSetting(s)"
              />
              <span class="text-xs text-slate-400">{{ s.settingValue === '1' ? '开启' : '关闭' }}</span>
            </label>
            <!-- 文本类 -->
            <div v-else class="flex items-center gap-2 shrink-0">
              <input v-model="s.settingValue" type="text" class="form-input text-sm py-1.5 w-48" @keyup.enter="updateSetting(s)" />
              <button @click="updateSetting(s)" :disabled="saving === s.id" class="btn btn-primary text-xs py-1.5 px-3">
                {{ saving === s.id ? '保存中...' : '保存' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
