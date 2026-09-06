<script setup lang="ts">
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  type Plugin,
} from 'chart.js'
import { Bar } from 'vue-chartjs'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

/** K 线配色：遵循中国市场惯例「红涨绿跌」 */
const UP = '#f87171'    // 涨 → 红
const DOWN = '#34d399'  // 跌 → 绿
const AXIS_TEXT = '#64748b'
const GRID = 'rgba(148,163,184,0.08)'

interface OhlcPoint {
  date: string
  open: number
  close: number
  high: number
  low: number
  net: number
  count: number
}

/**
 * 影线插件：实体由「浮动柱状条」[open, close] 绘制，
 * 这里只补画上下影线（high/low）以及十字星横线。
 */
const candleWickPlugin: Plugin = {
  id: 'candleWick',
  afterDatasetsDraw(chart) {
    const { ctx } = chart
    const yScale = chart.scales?.y
    if (!yScale) return

    const meta = chart.getDatasetMeta(0)
    const ds = chart.data.datasets?.[0] as any
    const ohlc = (ds?.ohlc || []) as OhlcPoint[]
    if (!meta?.data?.length) return

    meta.data.forEach((el: any, i: number) => {
      const o = ohlc[i]
      if (!o) return
      const x = el.x
      const rising = o.close >= o.open
      const bodyTop = Math.max(o.open, o.close)
      const bodyBottom = Math.min(o.open, o.close)

      ctx.save()
      ctx.strokeStyle = rising ? UP : DOWN
      ctx.lineWidth = 1

      // 上影线：high → 实体上沿
      ctx.beginPath()
      ctx.moveTo(x, yScale.getPixelForValue(o.high))
      ctx.lineTo(x, yScale.getPixelForValue(bodyTop))
      ctx.stroke()

      // 下影线：实体下沿 → low
      ctx.beginPath()
      ctx.moveTo(x, yScale.getPixelForValue(bodyBottom))
      ctx.lineTo(x, yScale.getPixelForValue(o.low))
      ctx.stroke()

      // 十字星（open === close）：实体高度为 0，补一条横向短线
      if (o.open === o.close) {
        ctx.beginPath()
        ctx.moveTo(x - 3.5, yScale.getPixelForValue(o.open))
        ctx.lineTo(x + 3.5, yScale.getPixelForValue(o.open))
        ctx.stroke()
      }

      ctx.restore()
    })
  },
}

const props = withDefaults(defineProps<{
  points: OhlcPoint[]
  height?: number
}>(), {
  height: 132,
})

const labels = computed(() => props.points.map(p => p.date.slice(5)))

const chartData = computed(() => ({
  labels: labels.value,
  datasets: [
    {
      label: '累计积分',
      // 浮动柱状条：实体区间 [open, close]
      data: props.points.map(p => [p.open, p.close] as [number, number]),
      ohlc: props.points.map(p => ({
        open: p.open,
        close: p.close,
        high: p.high,
        low: p.low,
      })),
      backgroundColor: props.points.map(p => (p.close >= p.open ? UP : DOWN)),
      borderColor: props.points.map(p => (p.close >= p.open ? UP : DOWN)),
      borderWidth: 1,
      barPercentage: 0.72,
      categoryPercentage: 0.82,
    } as any,
  ],
}))

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 320 },
  interaction: { mode: 'index' as const, intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(15,23,42,0.96)',
      borderColor: 'rgba(107,149,198,0.35)',
      borderWidth: 1,
      titleColor: '#c2cfe0',
      bodyColor: '#c2cfe0',
      padding: 8,
      displayColors: false,
      titleFont: { size: 11 },
      bodyFont: { size: 11 },
      callbacks: {
        title: (items: any[]) => props.points[items[0]?.dataIndex]?.date ?? '',
        label: (item: any) => {
          const p = props.points[item.dataIndex]
          if (!p) return ''
          return [
            `开 ${p.open}   收 ${p.close}`,
            `高 ${p.high}   低 ${p.low}`,
            `${p.close >= p.open ? '涨' : '跌'} ${p.close >= p.open ? '+' : ''}${p.net}（${p.count} 次操作）`,
          ]
        },
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      border: { color: GRID },
      ticks: {
        color: AXIS_TEXT,
        font: { size: 9 },
        maxRotation: 0,
        autoSkip: true,
        maxTicksLimit: 7,
      },
    },
    y: {
      grid: { color: GRID },
      border: { display: false },
      ticks: {
        color: AXIS_TEXT,
        font: { size: 9 },
        precision: 0,
        maxTicksLimit: 5,
      },
    },
  },
}))
</script>

<template>
  <div :style="{ height: `${height}px` }" class="w-full">
    <Bar :data="chartData" :options="chartOptions" :plugins="[candleWickPlugin]" />
  </div>
</template>
