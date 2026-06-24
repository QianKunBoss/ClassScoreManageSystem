<script setup lang="ts">
import type { User, ScoreTemplate, SeatData, SeatLayoutConfig, PaginatedResponse } from '~/types'
import { formatTime } from '~/utils/format'

definePageMeta({ auth: true })

const { data: authData } = useFetch('/api/auth/me', {
  credentials: 'include', server: false,
  default: () => ({ success: false, admin: null }),
})
const currentUser = computed(() => authData.value?.admin || null)

// 学校列表（超级管理员用）
const schools = ref<any[]>([])
const filterSchoolId = ref<number | null>(null)

// 数据
const users = ref<User[]>([])
const templates = ref<ScoreTemplate[]>([])
const recentLogs = ref<any[]>([])
const seats = ref<SeatData[]>([])
const layout = ref<SeatLayoutConfig | null>(null)
const loading = ref(true)

// 班级筛选（仅学校/年级管理员生效）
const filterClasses = ref<any[]>([])
const filterClassId = ref<number | ''>('')
// 当前有效的 classId（班级管理员自动使用自己的班级）
const effectiveClassId = computed(() => {
  if (currentUser.value?.role === 'class_admin') return currentUser.value.classId
  return filterClassId.value ? Number(filterClassId.value) : null
})

// 选择模式: search / list / seat
const selectionMode = ref<'search' | 'list' | 'seat'>('search')

// 已选用户 (多选)
const selectedUsers = ref<User[]>([])

// 搜索
const searchQuery = ref('')
const searchResults = ref<User[]>([])
const showSearchResults = ref(false)

// 列表分页
const listSearchQuery = ref('')

// 积分操作
const scoreChange = ref(1)
const description = ref('')
const submitting = ref(false)
const operationResult = ref<{ success: boolean; message: string } | null>(null)

// 模板管理弹窗
const showTemplateModal = ref(false)

watchEffect(async () => {
  if (!currentUser.value) return

  // 班级管理员自动使用自己的班级
  if (currentUser.value?.role === 'class_admin' && currentUser.value.classId) {
    filterClassId.value = currentUser.value.classId
  }

  // 加载班级列表（用于列表勾选筛选）
  if (currentUser.value?.role === 'school_admin' || currentUser.value?.role === 'grade_admin') {
    try {
      const query: any = {}
      if (currentUser.value?.role === 'school_admin') {
        query.schoolId = currentUser.value.schoolId
      } else if (currentUser.value?.role === 'grade_admin') {
        query.gradeId = currentUser.value.gradeId
      }
      const res = await $fetch<{ success: boolean, data: any[] }>('/api/classes', { query })
      filterClasses.value = res.data || []
    } catch {
      filterClasses.value = []
    }
  } else {
    filterClasses.value = []
  }

  // 超级管理员加载学校列表
  if (currentUser.value?.role === 'super_admin' && schools.value.length === 0) {
    try {
      const res = await $fetch<{ success: boolean, data: any[] }>('/api/schools')
      schools.value = res.data || []
    } catch {
      console.error('加载学校列表失败')
    }
  }

  try {
    const query: any = {}
    // 超级管理员需要传递 schoolId
    if (currentUser.value?.role === 'super_admin') {
      if (!filterSchoolId.value) {
        users.value = []
        templates.value = []
        recentLogs.value = []
        seats.value = []
        layout.value = null
        loading.value = false
        return
      }
      query.schoolId = filterSchoolId.value
    }

    // 基础数据：用户、模板、最近记录
    const [usersRes, templatesRes, logsRes] = await Promise.all([
      $fetch<PaginatedResponse<User>>('/api/users', { params: { ...query, limit: 200 } }),
      $fetch<{ data: ScoreTemplate[] }>('/api/scores/templates', { params: query }),
      $fetch<PaginatedResponse<any>>('/api/scores/logs', { params: { ...query, limit: 20 } }),
    ])
    users.value = usersRes.data
    templates.value = templatesRes.data
    recentLogs.value = logsRes.data

    // 座位数据：仅当有 classId 时加载
    if (effectiveClassId.value) {
      const [seatsRes, layoutRes] = await Promise.all([
        $fetch<{ data: SeatData[] }>('/api/seats/data', { params: { ...query, classId: effectiveClassId.value } }),
        $fetch<{ data: SeatLayoutConfig | null }>('/api/seats/layout', { params: { ...query, classId: effectiveClassId.value } }),
      ])
      seats.value = seatsRes.data
      layout.value = layoutRes.data
    } else {
      seats.value = []
      layout.value = null
    }
  } catch (err) { console.error(err) }
  finally { loading.value = false }
})

// ===== 搜索模式 =====
watch(searchQuery, (val) => {
  if (!val.trim()) { searchResults.value = []; showSearchResults.value = false; return }
  const q = val.toLowerCase()
  searchResults.value = users.value.filter(u =>
    u.username.toLowerCase().includes(q) && !selectedUsers.value.find(s => s.id === u.id)
  ).slice(0, 5)
  showSearchResults.value = searchResults.value.length > 0
})

function addBySearch(user: User) {
  if (selectedUsers.value.find(s => s.id === user.id)) return
  selectedUsers.value.push(user)
  searchQuery.value = ''
}

// ===== 列表模式 =====
const filteredUsers = computed(() => {
  let list = users.value
  // 班级筛选（仅学校/年级管理员生效）
  if (filterClassId.value) {
    list = list.filter(u => u.classId === filterClassId.value)
  }
  if (!listSearchQuery.value.trim()) {
    // 按用户名 A-Z 排序
    return list.sort((a, b) => (a.username || '').localeCompare(b.username || '', 'zh-CN'))
  }
  const filtered = list.filter(u => u.username.toLowerCase().includes(listSearchQuery.value.toLowerCase()))
  // 搜索结果也按 A-Z 排序
  return filtered.sort((a, b) => (a.username || '').localeCompare(b.username || '', 'zh-CN'))
})

function toggleListUser(user: User) {
  const idx = selectedUsers.value.findIndex(s => s.id === user.id)
  if (idx >= 0) selectedUsers.value.splice(idx, 1)
  else selectedUsers.value.push(user)
}

function isListSelected(userId: number) {
  return selectedUsers.value.some(s => s.id === userId)
}

// ===== 座位模式 =====
const seatSelectedIds = ref<number[]>([])

function toggleSeatUser(userId: number | null) {
  if (!userId) return
  const user = users.value.find(u => u.id === userId)
  if (!user) return
  const idx = selectedUsers.value.findIndex(s => s.id === userId)
  if (idx >= 0) {
    selectedUsers.value.splice(idx, 1)
    seatSelectedIds.value = seatSelectedIds.value.filter(id => id !== userId)
  } else {
    selectedUsers.value.push(user)
    seatSelectedIds.value.push(userId)
  }
}

// ===== 通用 =====
function removeUser(userId: number) {
  selectedUsers.value = selectedUsers.value.filter(s => s.id !== userId)
  seatSelectedIds.value = seatSelectedIds.value.filter(id => id !== userId)
}

function useTemplate(t: ScoreTemplate) {
  scoreChange.value = t.scoreChange
  description.value = t.description || ''
}

async function submitScores() {
  if (selectedUsers.value.length === 0) { operationResult.value = { success: false, message: '请选择至少一个用户' }; return }
  if (!description.value.trim()) { operationResult.value = { success: false, message: '请输入备注' }; return }
  
  submitting.value = true
  operationResult.value = null
  try {
    const query: any = {}
    // 超级管理员需要传递 schoolId
    if (currentUser.value?.role === 'super_admin' && filterSchoolId.value) {
      query.schoolId = filterSchoolId.value
    }
    
    const data = await $fetch('/api/scores/add', {
      method: 'POST',
      body: {
        users: selectedUsers.value.map(u => ({
          username: u.username,
          score_change: scoreChange.value,
        })),
        description: description.value,
      },
      query,
    })
    if (data.success) {
      operationResult.value = { success: true, message: data.message || `成功为 ${selectedUsers.value.length} 名用户操作` }
      
      const refreshQuery: any = {}
      if (currentUser.value?.role === 'super_admin' && filterSchoolId.value) {
        refreshQuery.schoolId = filterSchoolId.value
      }
      
      const [usersRes, logsRes] = await Promise.all([
        $fetch<PaginatedResponse<User>>('/api/users', { params: { ...refreshQuery, limit: 200 } }),
        $fetch<PaginatedResponse<any>>('/api/scores/logs', { params: { ...refreshQuery, limit: 20 } }),
      ])
      users.value = usersRes.data
      recentLogs.value = logsRes.data
      description.value = ''
      scoreChange.value = 1
    } else {
      operationResult.value = { success: false, message: data.message || '操作失败' }
    }
  } catch (err) { operationResult.value = { success: false, message: err.data?.message || '操作失败' } }
  finally { submitting.value = false }
}

function formatTime(timeStr: string) {
  if (!timeStr) return '未知'
  const d = new Date(timeStr); const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (isNaN(diff)) return '未知'
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return d.toLocaleDateString('zh-CN')
}

// 加载模板数据（模板管理弹窗打开时刷新）
async function refreshTemplates() {
  const query: any = {}
  if (currentUser.value?.role === 'super_admin' && filterSchoolId.value) {
    query.schoolId = filterSchoolId.value
  }
  const res = await $fetch<{ data: ScoreTemplate[] }>('/api/scores/templates', { params: query })
  templates.value = res.data
}
</script>

<template>
  <div>
    <!-- 页头 -->
    <section class="border-b border-slate-800/50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-slate-100 mb-1">积分管理</h1>
          <p class="text-sm text-slate-500">单选或多选用户，批量加减分</p>
        </div>
        <div class="flex items-center gap-3">
          <!-- 学校筛选（仅超级管理员显示） -->
          <select
            v-if="currentUser?.role === 'super_admin'"
            v-model="filterSchoolId"
            class="form-input text-sm py-1.5 w-48"
          >
            <option :value="null">请选择学校</option>
            <option v-for="s in schools" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
          <button @click="showTemplateModal = true" class="btn btn-ghost text-sm">管理模板</button>
        </div>
      </div>
    </section>

    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- ===== 左侧：用户选择 + 操作面板 ===== -->
        <div class="lg:col-span-2 space-y-6">
          <!-- 选择模式切换 -->
          <div class="glass-card p-1 flex animate-slide-up">
            <button
              v-for="mode in ([
                { key: 'search', label: '搜索添加' },
                { key: 'list', label: '列表勾选' },
                { key: 'seat', label: '座位表' },
              ] as const)"
              :key="mode.key"
              @click="selectionMode = mode.key"
              :class="`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                selectionMode === mode.key
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`"
            >
              {{ mode.label }}
            </button>
          </div>

          <!-- 已选用户 -->
          <div v-if="selectedUsers.length > 0" class="glass-card p-4 animate-slide-up">
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs font-medium text-slate-400 uppercase">已选 {{ selectedUsers.length }} 人</span>
              <button @click="selectedUsers = []; seatSelectedIds = []" class="text-xs text-red-400 hover:text-red-300">清空</button>
            </div>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="u in selectedUsers"
                :key="u.id"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300"
              >
                {{ u.username }}
                <button @click="removeUser(u.id)" class="hover:text-red-400">✕</button>
              </span>
            </div>
          </div>

          <!-- 模式1：搜索添加 -->
          <div v-if="selectionMode === 'search'" class="glass-card p-6 animate-slide-up">
            <h2 class="text-sm font-bold text-slate-100 mb-4">搜索添加</h2>
            <div class="relative">
              <input
                v-model="searchQuery"
                type="text" placeholder="输入用户名搜索并添加..."
                class="form-input"
              />
              <div v-if="showSearchResults" class="absolute z-10 w-full mt-2 glass-card p-1.5">
                <div
                  v-for="u in searchResults"
                  :key="u.id"
                  @click="addBySearch(u)"
                  class="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-800/50 cursor-pointer transition-all"
                >
                  <div class="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center font-bold text-indigo-400 text-sm">
                    {{ u.username.charAt(0).toUpperCase() }}
                  </div>
                  <div class="flex-1">
                    <p class="text-sm font-medium text-slate-200">{{ u.username }}</p>
                    <p class="text-xs text-slate-600">积分：{{ u.totalScore }}</p>
                  </div>
                  <span class="text-xs text-indigo-400">+ 添加</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 模式2：列表勾选 -->
          <div v-if="selectionMode === 'list'" class="glass-card p-6 animate-slide-up">
            <div class="flex items-center gap-3 mb-4 flex-wrap">
              <h2 class="text-sm font-bold text-slate-100">列表勾选</h2>
              <!-- 班级筛选（仅学校/年级管理员显示） -->
              <select
                v-if="filterClasses.length > 0"
                v-model="filterClassId"
                class="form-input text-xs py-1.5 w-36"
              >
                <option :value="''">全部班级</option>
                <option v-for="c in filterClasses" :key="c.id" :value="c.id">
                  {{ c.gradeName ? c.gradeName + ' / ' : '' }}{{ c.name }}
                </option>
              </select>
              <input
                v-model="listSearchQuery"
                type="text" placeholder="搜索..." class="form-input text-xs py-1.5 w-48 ml-auto"
              />
            </div>
            <div class="max-h-96 overflow-y-auto space-y-1">
              <label
                v-for="u in filteredUsers"
                :key="u.id"
                class="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-800/30 cursor-pointer transition-all"
              >
                <input
                  type="checkbox"
                  :checked="isListSelected(u.id)"
                  @change="toggleListUser(u)"
                  class="w-4 h-4 rounded accent-indigo-500"
                />
                <div class="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center font-bold text-indigo-400 text-xs">
                  {{ u.username.charAt(0).toUpperCase() }}
                </div>
                <span class="text-sm text-slate-200 flex-1">{{ u.username }}</span>
                <span class="text-xs text-indigo-400 font-bold">{{ u.totalScore }}分</span>
              </label>
            </div>
            <!-- 列表模式内的已选用户 -->
            <div v-if="selectedUsers.length > 0" class="mt-4 pt-4 border-t border-slate-800/50">
              <p class="text-xs text-slate-500 mb-2">已选 {{ selectedUsers.length }} 人</p>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="u in selectedUsers"
                  :key="u.id"
                  class="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300"
                >
                  {{ u.username }}
                  <button @click="removeUser(u.id)" class="hover:text-red-400 ml-0.5">✕</button>
                </span>
              </div>
            </div>
          </div>

          <!-- 模式3：座位表 -->
          <div v-if="selectionMode === 'seat'" class="glass-card p-6 animate-slide-up">
            <h2 class="text-sm font-bold text-slate-100 mb-4">座位表选择</h2>
            <div v-if="layout && seats.length > 0">
              <SeatsGrid
                :seats="seats"
                :group-count="layout.groupCount"
                :rows-per-group="layout.rowsPerGroup"
                :cols-per-group="layout.colsPerGroup"
                :selected-user-ids="seatSelectedIds"
                @toggle="(uid) => toggleSeatUser(uid)"
              />
            </div>
            <div v-else class="text-center py-8 text-slate-600 text-sm">
              暂无座位数据，请先在
              <NuxtLink to="/admin/seats" class="text-indigo-400">座位管理</NuxtLink>
              中配置
            </div>
          </div>

          <!-- 操作面板 -->
          <div class="glass-card p-6 animate-slide-up">
            <h2 class="text-sm font-bold text-slate-100 mb-4">积分操作</h2>

            <!-- 快捷模板 -->
            <div class="flex flex-wrap gap-2 mb-4" v-if="templates.length > 0">
              <button
                v-for="t in templates.slice(0, 6)"
                :key="t.id"
                @click="useTemplate(t)"
                :class="`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  description === (t.description || '')
                    ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                    : 'bg-slate-800/30 border-slate-700/50 text-slate-400 hover:border-indigo-500/30'
                }`"
              >
                {{ t.name }}
                <span :class="t.scoreChange > 0 ? 'text-green-400' : 'text-red-400'">
                  {{ t.scoreChange > 0 ? '+' : '' }}{{ t.scoreChange }}
                </span>
              </button>
            </div>

            <div class="space-y-4">
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase">分数调整</label>
                <div class="flex items-center gap-3">
                  <button @click="scoreChange = scoreChange - 1" class="w-11 h-11 rounded-lg bg-red-500/10 text-red-400 font-bold text-xl hover:bg-red-500/20 transition-all">−</button>
                  <input v-model.number="scoreChange" type="number" class="form-input text-center text-xl font-bold" />
                  <button @click="scoreChange = scoreChange + 1" class="w-11 h-11 rounded-lg bg-green-500/10 text-green-400 font-bold text-xl hover:bg-green-500/20 transition-all">+</button>
                </div>
              </div>

              <div>
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase">备注</label>
                <textarea v-model="description" placeholder="请输入操作备注..." rows="2" class="form-input resize-none"></textarea>
              </div>

              <button
                @click="submitScores"
                :disabled="submitting || selectedUsers.length === 0"
                class="btn btn-primary w-full py-3"
              >
                <span v-if="submitting" class="flex items-center gap-2">
                  <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  处理中...
                </span>
                <span v-else>
                  为 {{ selectedUsers.length }} 名用户 {{ scoreChange > 0 ? '加' : '扣' }}{{ Math.abs(scoreChange) }} 分
                </span>
              </button>

              <div
                v-if="operationResult"
                :class="`px-4 py-3 rounded-lg border text-sm ${
                  operationResult.success ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`"
              >
                {{ operationResult.success ? '✓' : '⚠' }} {{ operationResult.message }}
              </div>
            </div>
          </div>
        </div>

        <!-- ===== 右侧：最近记录 ===== -->
        <div>
          <div class="glass-card p-5 lg:sticky lg:top-20 animate-slide-up">
            <h2 class="text-sm font-bold text-slate-100 mb-4">最近记录</h2>
            <div v-if="loading" class="space-y-3">
              <div v-for="i in 6" :key="i" class="h-14 rounded-lg bg-slate-800/40 animate-pulse"></div>
            </div>
            <div v-else-if="recentLogs.length === 0" class="text-center py-8 text-slate-600 text-sm">暂无记录</div>
            <div v-else class="space-y-2">
              <div v-for="log in recentLogs.slice(0, 15)" :key="log.id" class="p-3 rounded-lg hover:bg-slate-800/30 transition-all">
                <div class="flex items-start justify-between mb-1">
                  <p class="text-xs text-slate-300 truncate flex-1">{{ log.description || '积分调整' }}</p>
                  <span :class="`text-xs font-bold ml-2 ${log.scoreChange > 0 ? 'text-green-400' : 'text-red-400'}`">
                    {{ log.scoreChange > 0 ? '+' : '' }}{{ log.scoreChange }}
                  </span>
                </div>
                <p class="text-xs text-slate-600">{{ log.username }} · {{ formatTime(log.createdAt) }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 模板管理弹窗 -->
    <ClientOnly>
      <Teleport to="body">
        <div v-if="showTemplateModal" class="modal-backdrop" @click.self="showTemplateModal = false">
          <div class="modal-content max-w-2xl">
            <div class="modal-header">
              <h3 class="text-base font-bold text-slate-100">快捷模板管理</h3>
              <button @click="showTemplateModal = false" class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500">✕</button>
            </div>
            <div class="modal-body">
              <TemplatesManager :schoolId="filterSchoolId" @updated="refreshTemplates" />
            </div>
          </div>
        </div>
      </Teleport>
    </ClientOnly>
  </div>
</template>

