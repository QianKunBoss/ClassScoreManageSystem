<script setup lang="ts">
import type { SeatData } from '~/types'

const props = defineProps<{
  seats: SeatData[]
  groupCount: number
  rowsPerGroup: number
  colsPerGroup: number
  selectedUserIds: number[]
}>()

const emit = defineEmits<{
  toggle: [userId: number | null, seatId: number]
}>()

const groups = computed(() => {
  const result: SeatData[][] = []
  for (let g = 0; g < props.groupCount; g++) {
    result.push(props.seats.filter(s => s.groupIndex === g))
  }
  return result
})

const maxCols = computed(() => Math.max(...props.seats.map(s => s.colIndex + 1), 0))
const maxRows = computed(() => Math.max(...props.seats.map(s => s.rowIndex + 1), 0))

function handleClick(seat: SeatData) {
  if (seat.isAisle) return
  emit('toggle', seat.userId, seat.id)
}
</script>

<template>
  <div class="overflow-x-auto">
    <div class="inline-flex gap-8 min-w-max">
      <!-- 每个组 -->
      <div
        v-for="(group, gi) in groups"
        :key="gi"
        class="flex flex-col items-center"
      >
        <span class="text-xs font-bold text-slate-500 mb-2">第{{ gi + 1 }}组</span>
        <div
          class="grid gap-1.5"
          :style="{ gridTemplateColumns: `repeat(${colsPerGroup}, 1fr)` }"
        >
          <template v-for="seat in group" :key="seat.id">
            <!-- 过道 -->
            <div
              v-if="seat.isAisle"
              class="w-12 h-12 rounded-md bg-slate-800/20 flex items-center justify-center text-slate-600 text-xs"
              title="过道"
            >
              ┊
            </div>
            <!-- 座位 -->
            <button
              v-else
              @click="handleClick(seat)"
              class="w-16 h-16 rounded-md text-xs font-bold transition-all duration-200 flex flex-col items-center justify-center border"
              :class="[
                seat.userId
                  ? selectedUserIds.includes(seat.userId)
                    ? 'bg-indigo-500/30 border-indigo-500 text-indigo-300 scale-105'
                    : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-700/60 hover:border-indigo-500/30'
                  : 'bg-slate-800/20 border-slate-800 text-slate-600 hover:bg-slate-800/40 hover:border-slate-700'
              ]"
              :title="(seat.actualName || seat.username || '空位')"
            >
              <span v-if="seat.userId" class="leading-tight text-center px-1 truncate w-full text-[11px]">{{ seat.actualName || seat.username }}</span>
              <span v-else class="text-[10px]">+</span>
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
