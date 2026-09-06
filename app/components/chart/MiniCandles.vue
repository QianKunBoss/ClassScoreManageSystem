<script setup lang="ts">
/**
 * 迷你 K 线图（纯 SVG，无 Canvas / 无 Chart.js 实例）
 * 配色遵循中国市场惯例「红涨绿跌」。
 */
interface MiniCandle {
  o: number
  c: number
  h: number
  l: number
}

const props = withDefaults(defineProps<{
  candles: MiniCandle[]
  width?: number
  height?: number
}>(), {
  width: 78,
  height: 26,
})

const UP = '#f87171'    // 涨 → 红
const DOWN = '#34d399'  // 跌 → 绿

const step = computed(() => {
  const n = props.candles?.length || 0
  return n > 0 ? props.width / n : 0
})

// 蜡烛体宽度：随密度自适应，并限制在 1~6px
const barW = computed(() => Math.max(1, Math.min(6, step.value * 0.62)))

const geom = computed(() => {
  const cs = props.candles || []
  if (cs.length === 0) return []

  let lo = Infinity
  let hi = -Infinity
  for (const c of cs) {
    if (c.l < lo) lo = c.l
    if (c.h > hi) hi = c.h
  }

  const pad = 1.5
  const h = props.height - pad * 2
  const span = hi - lo
  const y = (v: number) =>
    span === 0 ? pad + h / 2 : pad + h - ((v - lo) / span) * h

  return cs.map((c, i) => {
    const cx = i * step.value + step.value / 2
    const yO = y(c.o)
    const yC = y(c.c)
    return {
      cx,
      yH: y(c.h),
      yL: y(c.l),
      yTop: Math.min(yO, yC),
      bodyH: Math.max(1, Math.abs(yC - yO)),
      up: c.c >= c.o,
    }
  })
})
</script>

<template>
  <svg
    :width="width"
    :height="height"
    :viewBox="`0 0 ${width} ${height}`"
    class="shrink-0 block"
  >
    <g v-for="(c, i) in geom" :key="i">
      <!-- 影线：当日最高 ~ 最低 -->
      <line
        :x1="c.cx"
        :y1="c.yH"
        :x2="c.cx"
        :y2="c.yL"
        :stroke="c.up ? UP : DOWN"
        stroke-width="0.7"
      />
      <!-- 实体：开盘 ~ 收盘 -->
      <rect
        :x="c.cx - barW / 2"
        :y="c.yTop"
        :width="barW"
        :height="c.bodyH"
        :fill="c.up ? UP : DOWN"
      />
    </g>
  </svg>
</template>
