<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/**
 * 里程表风格数字：每位数字一条竖直滚轮，数值变化时向前进位滚动。
 * 纯 transform 实现，无渐变；数字前进方向固定（9 → 0 继续向前），符合机械里程表观感。
 */
const props = withDefaults(defineProps<{
  value?: number | string | null
  /** 单次滚动时长（ms） */
  duration?: number
  /** 相邻数位的错峰延迟（ms），个位最先动 */
  stagger?: number
  /** 挂载时是否从 0 滚到目标值 */
  animateOnMount?: boolean
}>(), {
  value: 0,
  duration: 700,
  stagger: 45,
  animateOnMount: true,
})

interface Slot {
  ch: string
  isDigit: boolean
  pos: number
  animating: boolean
}

// 每格高度（em），JS 与 CSS 必须一致
const CELL_EM = 1.15
// 滚轮格数：0..9 重复三轮，容纳连续快速进位
const CELLS = 30

const slots = ref<Slot[]>([])
let resetTimer: ReturnType<typeof setTimeout> | null = null

const displayText = computed(() => String(props.value ?? 0))

function build(str: string, posOf: (d: number) => number): Slot[] {
  return [...str].map((ch) => {
    const isDigit = /\d/.test(ch)
    return { ch, isDigit, pos: isDigit ? posOf(Number(ch)) : 0, animating: false }
  })
}

function structureOf(list: Slot[]) {
  return list.map((s) => (s.isDigit ? 'd' : s.ch)).join('')
}

/** 右侧还有几位数字（用于错峰：个位 0ms，十位 45ms…） */
function digitsRight(index: number) {
  let n = 0
  for (let i = index + 1; i < slots.value.length; i++) if (slots.value[i].isDigit) n++
  return n
}

function stripStyle(slot: Slot, index: number) {
  return {
    transform: `translateY(${-(slot.pos * CELL_EM)}em)`,
    transitionDuration: `${props.duration}ms`,
    transitionDelay: slot.animating ? `${digitsRight(index) * props.stagger}ms` : '0ms',
  }
}

function clearReset() {
  if (resetTimer) {
    clearTimeout(resetTimer)
    resetTimer = null
  }
}

/** 动画结束后把 pos 归一化回 0..9：先关过渡，再改值，避免回弹 */
async function scheduleReset() {
  clearReset()
  const total = props.duration + props.stagger * slots.value.length + 60
  resetTimer = setTimeout(async () => {
    slots.value = slots.value.map((s) => (s.isDigit ? { ...s, animating: false } : s))
    await nextTick()
    slots.value = slots.value.map((s) => (s.isDigit ? { ...s, pos: s.pos % 10 } : s))
    resetTimer = null
  }, total)
}

async function applyValue() {
  const str = displayText.value

  // 结构变化（位数增减、出现负号/小数点）：直接落位，不做滚动
  if (!slots.value.length || structureOf(slots.value) !== [...str].map((c) => (/\d/.test(c) ? 'd' : c)).join('')) {
    slots.value = build(str, (d) => d)
    return
  }

  const next = slots.value.map((s) => ({ ...s }))
  let moved = false
  next.forEach((s, i) => {
    if (!s.isDigit) return
    const target = Number(str[i])
    const delta = (target - (s.pos % 10) + 10) % 10 // 只向前进位
    if (delta === 0) return
    s.pos += delta
    s.animating = true
    moved = true
  })
  slots.value = next
  if (moved) await scheduleReset()
}

onMounted(async () => {
  if (!props.animateOnMount) {
    slots.value = build(displayText.value, (d) => d)
    return
  }
  // 先在 0 落位并完成一次绘制，再打开过渡滚到目标值，否则可能被合并成一次样式计算而不产生动画
  slots.value = build(displayText.value, () => 0)
  await nextTick()
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  const chars = [...displayText.value]
  slots.value = slots.value.map((s, i) => (s.isDigit ? { ...s, pos: Number(chars[i]), animating: true } : s))
  await scheduleReset()
})

watch(() => props.value, applyValue)
onBeforeUnmount(clearReset)
</script>

<template>
  <span class="odometer" role="img" :aria-label="displayText">
    <template v-for="(slot, i) in slots" :key="i">
      <span v-if="!slot.isDigit" class="od-static" aria-hidden="true">{{ slot.ch }}</span>
      <span v-else class="od-digit" aria-hidden="true">
        <span class="od-strip" :class="{ 'is-animating': slot.animating }" :style="stripStyle(slot, i)">
          <span v-for="n in CELLS" :key="n" class="od-cell">{{ (n - 1) % 10 }}</span>
        </span>
      </span>
    </template>
  </span>
</template>

<style scoped>
.odometer {
  display: inline-flex;
  align-items: center;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  vertical-align: baseline;
}
.od-digit {
  position: relative;
  display: inline-block;
  width: 1ch;
  height: 1.15em;
  overflow: hidden;
}
.od-strip {
  display: flex;
  flex-direction: column;
  will-change: transform;
  transition: none;
}
.od-strip.is-animating {
  transition-property: transform;
  transition-timing-function: cubic-bezier(0.22, 0.61, 0.36, 1);
}
.od-cell {
  display: block;
  height: 1.15em;
  line-height: 1.15em;
  text-align: center;
}
.od-static {
  display: inline-block;
}
@media (prefers-reduced-motion: reduce) {
  .od-strip.is-animating {
    transition: none;
  }
}
</style>
