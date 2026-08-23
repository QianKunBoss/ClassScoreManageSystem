<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue?: string
    max?: string
    placeholder?: string
  }>(),
  { modelValue: '', max: '', placeholder: '选择日期' },
)

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

const WEEK = ['一', '二', '三', '四', '五', '六', '日']

function pad(n: number) {
  return String(n).padStart(2, '0')
}
function toYmd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const today = new Date()
const todayStr = toYmd(today)

const selected = computed(() => props.modelValue)

const viewDate = ref(
  props.modelValue ? new Date(props.modelValue + 'T00:00:00') : new Date(),
)
const viewYear = computed(() => viewDate.value.getFullYear())
const viewMonth = computed(() => viewDate.value.getMonth())

// 打开时定位到当前选中日期所在月份
watch(open, (v) => {
  if (v && props.modelValue) {
    const d = new Date(props.modelValue + 'T00:00:00')
    if (!Number.isNaN(d.getTime())) viewDate.value = d
  }
})

// 生成日历格子（周一为每周首日，前导补齐）
const cells = computed(() => {
  const y = viewYear.value
  const m = viewMonth.value
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const lead = (new Date(y, m, 1).getDay() + 6) % 7 // 周一=0
  const list: { day: number; date: string }[] = []
  for (let i = 0; i < lead; i++) list.push({ day: 0, date: '' })
  for (let d = 1; d <= daysInMonth; d++) list.push({ day: d, date: `${y}-${pad(m + 1)}-${pad(d)}` })
  return list
})

function isDisabled(date: string) {
  if (!date) return true
  if (props.max && date > props.max) return true
  return false
}

function cellClass(c: { day: number; date: string }) {
  if (!c.day) return 'dp-cell dp-empty'
  const cls = ['dp-cell']
  if (isDisabled(c.date)) cls.push('dp-disabled')
  if (c.date === selected.value) cls.push('dp-selected')
  else if (c.date === todayStr) cls.push('dp-today')
  return cls.join(' ')
}

function prevMonth() {
  viewDate.value = new Date(viewYear.value, viewMonth.value - 1, 1)
}
function nextMonth() {
  viewDate.value = new Date(viewYear.value, viewMonth.value + 1, 1)
}

function pick(date: string) {
  if (!date || isDisabled(date)) return
  emit('update:modelValue', date)
  open.value = false
}

function onDocClick(e: MouseEvent) {
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) open.value = false
}
onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <div ref="rootRef" class="relative">
    <button
      type="button"
      class="dp-trigger"
      :class="{ 'dp-trigger-active': open }"
      @click="open = !open"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
      <span>{{ selected || placeholder }}</span>
      <svg
        width="10"
        height="10"
        viewBox="0 0 12 8"
        fill="none"
        aria-hidden="true"
      >
        <path d="M6 8L0 0h12z" fill="currentColor" opacity="0.6" />
      </svg>
    </button>

    <Transition name="dp">
      <div v-if="open" class="dp-panel">
        <div class="dp-head">
          <button type="button" class="dp-nav" aria-label="上个月" @click="prevMonth">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <span class="dp-title">{{ viewYear }}年{{ viewMonth + 1 }}月</span>
          <button type="button" class="dp-nav" aria-label="下个月" @click="nextMonth">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>

        <div class="dp-week">
          <span v-for="w in WEEK" :key="w">{{ w }}</span>
        </div>

        <div class="dp-grid">
          <button
            v-for="(c, i) in cells"
            :key="i"
            type="button"
            :class="cellClass(c)"
            :disabled="isDisabled(c.date)"
            @click="pick(c.date)"
          >
            {{ c.day || '' }}
          </button>
        </div>

        <div class="dp-foot">
          <button type="button" class="dp-today-btn" :disabled="isDisabled(todayStr)" @click="pick(todayStr)">
            今天
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.dp-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  background: rgba(10, 16, 28, 0.6);
  border: 1px solid rgba(110, 140, 180, 0.18);
  border-radius: 0.5rem;
  color: #dbe4f0;
  font-size: 0.75rem;
  line-height: 1.25rem;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}
.dp-trigger:hover {
  border-color: rgba(110, 140, 180, 0.4);
  background: rgba(10, 16, 28, 0.8);
}
.dp-trigger-active,
.dp-trigger:focus-visible {
  outline: none;
  border-color: #4a7ab5;
  box-shadow: 0 0 0 3px rgba(74, 122, 181, 0.18);
}

.dp-panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 60;
  width: 268px;
  padding: 0.75rem;
  background: #0d1522;
  border: 1px solid rgba(110, 140, 180, 0.22);
  border-radius: 0.75rem;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
}

.dp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}
.dp-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #dbe4f0;
}
.dp-nav {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 0.375rem;
  color: #8b99b0;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.dp-nav:hover {
  background: rgba(110, 140, 180, 0.15);
  color: #dbe4f0;
}

.dp-week {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 0.25rem;
}
.dp-week span {
  text-align: center;
  font-size: 0.6875rem;
  color: #64748b;
  padding: 0.25rem 0;
}

.dp-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}
.dp-cell {
  position: relative;
  height: 32px;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  color: #c2cfe0;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.dp-cell:hover:not(:disabled):not(.dp-selected) {
  background: rgba(110, 140, 180, 0.15);
}
.dp-cell.dp-empty {
  cursor: default;
}
.dp-cell.dp-disabled {
  color: rgba(100, 116, 139, 0.45);
  cursor: not-allowed;
}
.dp-cell.dp-today {
  box-shadow: inset 0 0 0 1px #4a7ab5;
  color: #8fc0ff;
}
.dp-cell.dp-selected {
  background: #4a7ab5;
  color: #ffffff;
  font-weight: 600;
}

.dp-foot {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(110, 140, 180, 0.14);
  text-align: right;
}
.dp-today-btn {
  font-size: 0.75rem;
  color: #8fc0ff;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background 0.15s ease;
}
.dp-today-btn:hover:not(:disabled) {
  background: rgba(74, 122, 181, 0.15);
}
.dp-today-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 弹层动画 */
.dp-enter-active,
.dp-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.dp-enter-from,
.dp-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* 浅色主题适配 */
.light .dp-trigger {
  background: rgba(255, 255, 255, 0.85);
  border-color: rgba(110, 140, 180, 0.3);
  color: #1e293b;
}
.light .dp-panel {
  background: #ffffff;
  border-color: rgba(110, 140, 180, 0.25);
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.12);
}
.light .dp-title {
  color: #1e293b;
}
.light .dp-cell {
  color: #334155;
}
.light .dp-cell:hover:not(:disabled):not(.dp-selected) {
  background: rgba(74, 122, 181, 0.1);
}
.light .dp-week span {
  color: #94a3b8;
}
</style>
