<script setup lang="ts">
import type { School } from '~/types'
import { formatDate } from '~/utils/format'

definePageMeta({ middleware: 'super-admin', layout: 'superadmin' })

const toast = useToast()

// 学校管理
const schools = ref<School[]>([])
const loading = ref(true)

// 封禁确认
const confirmToggleSchool = ref<School | null>(null)

async function loadSchools() {
  loading.value = true
  try {
    // 超级管理员需要看到所有学校（包括被封禁的）
    const res = await $fetch<{ data: School[] }>('/api/schools', {
      params: { includeDisabled: '1' }
    })
    schools.value = res.data
  } catch { toast.error('加载学校失败') }
  finally { loading.value = false }
}

async function toggleSchoolDisabled(school: any) {
  confirmToggleSchool.value = school
}

async function confirmToggleSchoolDisabled() {
  const school = confirmToggleSchool.value
  if (!school) return
  const newStatus = school.disabled === 1 ? 0 : 1
  try {
    await $fetch(`/api/schools/${school.id}`, {
      method: 'PATCH',
      body: { disabled: newStatus },
    })
    toast.success(`学校已${newStatus === 1 ? '封禁' : '启用'}`)
    confirmToggleSchool.value = null
    await loadSchools()
  } catch (err) {
    toast.error(err.data?.message || err.data?.statusMessage || '操作失败')
  }
}

onMounted(loadSchools)
</script>

<template>
  <div>
    <section class="border-b border-slate-800/50">
      <div class="px-4 sm:px-6 lg:px-8 py-6">
        <h1 class="text-xl font-bold text-slate-100 mb-1">学校管理</h1>
        <p class="text-sm text-slate-500">管理已入驻学校，封禁或进入学校详情管理</p>
      </div>
    </section>

    <section class="px-4 sm:px-6 lg:px-8 py-8">
      <div class="glass-card p-6 animate-slide-up">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-bold text-slate-100">学校列表</h2>
          <span class="text-xs text-slate-500">共 {{ schools.length }} 所学校</span>
        </div>
        <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div v-for="i in 3" :key="i" class="h-24 rounded-lg bg-slate-800/40 animate-pulse"></div>
        </div>
        <div v-else-if="schools.length === 0" class="text-center py-8 text-sm text-slate-500">暂无学校，请先前往「入驻申请」审核</div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div v-for="s in schools" :key="s.id" class="flex items-center justify-between p-3 rounded-lg bg-slate-800/20 hover:bg-slate-800/40 transition-all" :class="s.disabled === 1 ? 'opacity-60' : ''">
            <div>
              <div class="text-sm font-medium text-slate-200">{{ s.name }}</div>
              <div class="text-xs text-slate-500 mt-0.5">ID: {{ s.id }} · {{ formatDate(s.createdAt) }}</div>
              <div v-if="s.disabled === 1" class="text-xs text-red-400 mt-0.5"><MorphIcon name="ban" size="1em" class="inline-block align-middle" /> 已封禁</div>
            </div>
            <div class="flex items-center gap-2">
              <button
                v-if="s.disabled !== 1"
                @click="toggleSchoolDisabled(s)"
                class="btn btn-ghost text-xs py-1 px-2 !text-red-400 hover:!bg-red-500/10"
              >
                封禁
              </button>
              <button
                v-else
                @click="toggleSchoolDisabled(s)"
                class="btn btn-ghost text-xs py-1 px-2 !text-emerald-400 hover:!bg-emerald-500/10"
              >
                启用
              </button>
              <NuxtLink :to="`/superadmin/schools/${s.id}`" class="btn btn-primary text-xs py-1 px-3">
                管理
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 封禁学校确认 -->
    <UiConfirm
      :show="!!confirmToggleSchool"
      :title="confirmToggleSchool?.disabled === 1 ? '启用学校' : '封禁学校'"
      :message="confirmToggleSchool ? `确定要${confirmToggleSchool.disabled === 1 ? '启用' : '封禁'}学校「${confirmToggleSchool.name}」吗？` : ''"
      :danger="confirmToggleSchool?.disabled !== 1"
      @confirm="confirmToggleSchoolDisabled"
      @cancel="confirmToggleSchool = null"
    />
  </div>
</template>
