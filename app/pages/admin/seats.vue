<script setup lang="ts">
import type { SeatLayoutConfig, SeatData, User, PaginatedResponse } from '~/types'

definePageMeta({ auth: true })

const toast = useToast()
const { data: authData } = useFetch('/api/auth/me', {
  credentials: 'include', server: false, default: () => ({ success: false, admin: null }),
})
const currentUser = computed(() => authData.value?.admin || null)
const canManageSeats = computed(() => !!currentUser.value)
const isClassAdmin = computed(() => currentUser.value?.role === 'class_admin')

// 班级列表 + 当前选中的班级
const classes = ref<{ id: number; name: string }[]>([])
const selectedClassId = ref<number | null>(null)

// 班级管理员自动锁定到自己管理的班级
watchEffect(async () => {
  if (!currentUser.value) return
  await loadClasses()
  if (isClassAdmin.value && currentUser.value?.classId) {
    selectedClassId.value = currentUser.value.classId
  }
})

const layout = ref<SeatLayoutConfig | null>(null)
const seats = ref<SeatData[]>([])
const users = ref<User[]>([])
const loading = ref(true)

// 只显示当前班级未分配座位的学生
const unassignedUsers = computed(() => {
  const classId = selectedClassId.value
  if (!classId) return []
  return users.value.filter(u => u.classId === classId && !seats.value.some(s => s.userId === u.id))
})

// 布局配置表单
const formGroupCount = ref(4)
const formRowsPerGroup = ref(6)
const formColsPerGroup = ref(2)

// 加载班级列表
async function loadClasses() {
  try {
    const res = await $fetch<{ data: { id: number; name: string }[] }>('/api/classes', { params: { limit: 200 } })
    classes.value = res.data || []
    // 自动选中第一个班级
    if (classes.value.length > 0 && !selectedClassId.value) {
      selectedClassId.value = classes.value[0].id
    }
  } catch (err) {
    toast.error('加载班级列表失败')
  }
}

// 加载当前选中班级的数据
async function loadData() {
  if (!selectedClassId.value) return
  loading.value = true
  try {
    const [layoutRes, seatsRes, usersRes] = await Promise.all([
      $fetch<{ data: SeatLayoutConfig | null }>('/api/seats/layout', {
        params: { classId: selectedClassId.value },
      }),
      $fetch<{ data: SeatData[] }>('/api/seats/data', {
        params: { classId: selectedClassId.value },
      }),
      $fetch<PaginatedResponse<User>>('/api/users', { params: { limit: 200 } }),
    ])
    layout.value = layoutRes.data
    seats.value = seatsRes.data || []
    users.value = usersRes.data || []
    if (layout.value) {
      formGroupCount.value = layout.value.groupCount
      formRowsPerGroup.value = layout.value.rowsPerGroup
      formColsPerGroup.value = layout.value.colsPerGroup
    }
  } catch (err: any) { toast.error(err.data?.message || '加载失败') }
  finally { loading.value = false }
}

watchEffect(async () => {
  if (!currentUser.value) return
  await loadClasses()
})
watch(() => selectedClassId.value, async () => {
  if (selectedClassId.value) await loadData()
})

async function saveLayout() {
  if (!selectedClassId.value) { toast.error('请先选择班级'); return }
  try {
    await $fetch('/api/seats/layout', {
      method: 'PATCH',
      body: {
        classId: selectedClassId.value,
        groupCount: formGroupCount.value,
        rowsPerGroup: formRowsPerGroup.value,
        colsPerGroup: formColsPerGroup.value,
        hasAisle: 0,
      },
    })
    toast.success('布局已保存')
    await loadData()
  } catch (err: any) { toast.error(err.data?.message || '保存失败') }
}

async function generateSeats() {
  if (!selectedClassId.value) { toast.error('请先选择班级'); return }
  try {
    const res = await $fetch<{ success: boolean; total: number }>('/api/seats/data/generate', {
      method: 'POST',
      body: { classId: selectedClassId.value },
    })
    toast.success(`已生成 ${res.total} 个座位`)
    await loadData()
  } catch (err: any) { toast.error(err.data?.message || '生成失败') }
}

// 拖拽分配
async function onDrop(userId: number | null, seatId: number) {
  try {
    await $fetch(`/api/seats/data/${seatId}`, { method: 'PATCH', body: { userId } })
    await loadData()
    if (userId) toast.success('座位已分配')
    else toast.info('座位已清空')
  } catch (err: any) { toast.error(err.data?.message || '操作失败') }
}

function onDragStart(e: DragEvent, userId: number, username: string, actualName: string) {
  e.dataTransfer!.setData('text/plain', JSON.stringify({ userId, username, actualName }))
  e.dataTransfer!.effectAllowed = 'move'
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'move'
}

function onDropOntoSeat(e: DragEvent, seatId: number) {
  e.preventDefault()
  const data = JSON.parse(e.dataTransfer!.getData('text/plain'))
  onDrop(data.userId, seatId)
}

function clearSeat(seatId: number) { onDrop(null, seatId) }

// 分组排序（只显示当前班级的座位）
const groups = computed(() => {
  const result: SeatData[][] = []
  if (!layout.value) return result
  for (let g = 0; g < layout.value.groupCount; g++) {
    result.push(seats.value.filter(s => s.groupIndex === g).sort((a, b) => a.rowIndex - b.rowIndex || a.colIndex - b.colIndex))
  }
  return result
})
</script>

<template>
  <div>
    <section class="border-b border-slate-800/50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-slate-100 mb-1">座位表管理</h1>
          <p class="text-sm text-slate-500">选择班级，配置布局并分配座位</p>
        </div>
        <div class="flex gap-2">
          <button v-if="canManageSeats" @click="generateSeats" class="btn btn-primary text-sm">生成座位表</button>
        </div>
      </div>
    </section>

    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <!-- 班级选择器 -->
      <div class="glass-card p-4 animate-slide-up flex items-center gap-4">
        <label class="text-xs font-medium text-slate-400 uppercase shrink-0">班级</label>
        <!-- 班级管理员：只读显示 -->
        <span v-if="isClassAdmin" class="form-input py-2 px-3 bg-slate-800/50 text-slate-300 min-w-[200px] cursor-default select-none">
          {{ classes.find(c => c.id === selectedClassId)?.name || '加载中...' }}
        </span>
        <!-- 非班级管理员：下拉选择 -->
        <select v-else v-model.number="selectedClassId" class="form-input py-2 min-w-[200px]">
          <option :value="null" disabled>— 请选择班级 —</option>
          <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <span v-if="!isClassAdmin && classes.length === 0" class="text-xs text-slate-500">暂无班级，请先创建</span>
      </div>

      <!-- 布局配置 -->
      <div v-if="selectedClassId && canManageSeats" class="glass-card p-5 animate-slide-up">
        <h2 class="text-sm font-bold text-slate-100 mb-4">布局配置（{{ classes.find(c => c.id === selectedClassId)?.name }}）</h2>
        <div class="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label class="block text-xs text-slate-400 mb-1.5">大组数</label>
            <input v-model.number="formGroupCount" type="number" min="1" max="8" class="form-input text-center" />
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1.5">每组行数</label>
            <input v-model.number="formRowsPerGroup" type="number" min="1" max="15" class="form-input text-center" />
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1.5">每组列数</label>
            <input v-model.number="formColsPerGroup" type="number" min="1" max="5" class="form-input text-center" />
          </div>
        </div>
        <div class="flex gap-2">
          <button @click="saveLayout" class="btn btn-primary text-sm">保存配置</button>
        </div>
      </div>

      <!-- 座位网格 -->
      <div v-if="selectedClassId && !loading && layout && seats.length > 0" class="glass-card p-6 animate-slide-up">
        <h2 class="text-sm font-bold text-slate-100 mb-2">座位表 · 拖拽右侧学生到座位格中</h2>
        <div class="overflow-x-auto pb-4">
          <div class="inline-flex gap-8 min-w-max items-start">
            <!-- 座位组 -->
            <div v-for="(group, gi) in groups" :key="gi" class="flex flex-col items-center">
              <span class="text-xs font-bold text-slate-500 mb-3 px-2">第{{ gi + 1 }}组</span>
              <div class="grid gap-2" :style="{ gridTemplateColumns: `repeat(${layout!.colsPerGroup}, 1fr)` }">
                <div
                  v-for="seat in group"
                  :key="seat.id"
                  :data-seat-id="seat.id"
                  class="w-20 h-20 rounded-xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center text-xs cursor-pointer select-none relative group"
                  :class="seat.userId
                    ? 'border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20'
                    : 'border-slate-700/30 bg-slate-800/20 hover:border-indigo-500/40 hover:bg-slate-800/40'"
                  @dragover="onDragOver"
                  @drop="onDropOntoSeat($event, seat.id)"
                >
                  <template v-if="seat.userId">
                    <span class="text-xs font-bold text-indigo-200 leading-tight text-center px-1 truncate w-full">
                      {{ seat.actualName || seat.username }}
                    </span>
                    <button
                      @click="clearSeat(seat.id)"
                      class="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ✕
                    </button>
                  </template>
                  <template v-else>
                    <span class="text-xl text-slate-600">+</span>
                  </template>
                </div>
              </div>
            </div>

            <!-- 待分配学生列表 -->
            <div class="flex flex-col items-center shrink-0">
              <span class="text-xs font-bold text-slate-500 mb-3 px-2">待分配学生</span>
              <div class="flex flex-col gap-1 w-44">
                <div
                  v-for="u in unassignedUsers"
                  :key="u.id"
                  draggable="true"
                  @dragstart="onDragStart($event, u.id, u.username, u.actualName || '')"
                  class="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-800/50 transition-all cursor-grab active:cursor-grabbing border border-transparent hover:border-indigo-500/30"
                >
                  <div class="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center font-bold text-indigo-400 text-xs shrink-0">
                    {{ (u.actualName || u.username).charAt(0).toUpperCase() }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-xs text-slate-200 truncate">{{ u.actualName || u.username }}</p>
                  </div>
                </div>
                <div v-if="unassignedUsers.length === 0" class="text-center py-4 text-slate-600 text-xs w-44">
                  所有学生已分配
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="selectedClassId && !loading && (!layout || seats.length === 0)" class="glass-card p-12 text-center animate-slide-up">
        <p class="text-slate-500 mb-4">尚未生成座位表</p>
        <button v-if="canManageSeats" @click="generateSeats" class="btn btn-primary">立即生成</button>
      </div>

      <div v-if="!selectedClassId && !loading" class="glass-card p-12 text-center animate-slide-up">
        <p class="text-slate-500">请先选择一个班级</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
</style>
