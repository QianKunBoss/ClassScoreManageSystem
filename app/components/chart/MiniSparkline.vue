<script setup lang="ts">
/**
 * 迷你折线图（纯 SVG，无 Canvas / 无 Chart.js 实例）
 * 用于排行榜每行内嵌 —— 学生数量可达 200+，Chart.js 实例过多会严重卡顿。
 */
const props = withDefaults(defineProps<{
  values: number[]
  width?: number
  height?: number
}>(), {
  width: 78,
  height: 26,
})

const STROKE = '#6b95c6'                    // brand-400 钢蓝
const FILL = 'rgba(107,149,198,0.16)'       // 纯色 alpha（禁止渐变）
const ZERO = 'rgba(148,163,184,0.35)'

const geom = computed(() => {
  const v = props.values || []
  const n = v.length
  if (n === 0) return null

  const max = Math.max(...v)
  const min = Math.min(...v)
  const span = max - min
  const pad = 2
  const h = props.height - pad * 2

  const y = (val: number) =>
    span === 0 ? pad + h / 2 : pad + h - ((val - min) / span) * h

  const step = n > 1 ? props.width / (n - 1) : 0
  const line = v
    .map((val, i) => `${(i * step).toFixed(1)},${y(val).toFixed(1)}`)
    .join(' ')

  // 有正有负时画 0 基准线；面积图以 0 线（或底边）为基线
  const zeroY = min < 0 && max > 0 ? y(0) : null
  const baseY = (zeroY ?? props.height - pad).toFixed(1)
  const area = `0,${baseY} ${line} ${props.width},${baseY}`

  return { line, area, zeroY }
})
</script>

<template>
  <svg
    :width="width"
    :height="height"
    :viewBox="`0 0 ${width} ${height}`"
    class="shrink-0 block"
  >
    <template v-if="geom">
      <polygon :points="geom.area" :fill="FILL" />
      <line
        v-if="geom.zeroY !== null"
        x1="0"
        :y1="geom.zeroY"
        :x2="width"
        :y2="geom.zeroY"
        :stroke="ZERO"
        stroke-width="0.6"
      />
      <polyline
        :points="geom.line"
        fill="none"
        :stroke="STROKE"
        stroke-width="1.2"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
    </template>
  </svg>
</template>
