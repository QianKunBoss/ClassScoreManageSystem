<script setup lang="ts">
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from 'chart.js'
import { Line } from 'vue-chartjs'

// 树摇按需注册（本项目禁止渐变，填充一律使用纯色 + alpha）
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

interface DayPoint {
  date: string
  net: number
  add: number
  deduct: number
  count: number
}

const props = withDefaults(defineProps<{
  points: DayPoint[]
  height?: number
}>(), {
  height: 132,
})

const BRAND = '#6b95c6'          // brand-400 钢蓝
const AXIS_TEXT = '#64748b'      // slate-500
const GRID = 'rgba(148,163,184,0.08)'
const ZERO_LINE = 'rgba(148,163,184,0.30)'

const labels = computed(() => props.points.map(p => p.date.slice(5))) // MM-DD

const chartData = computed(() => ({
  labels: labels.value,
  datasets: [
    {
      label: '每日净变化',
      data: props.points.map(p => p.net),
      borderColor: BRAND,
      backgroundColor: 'rgba(107,149,198,0.14)',
      borderWidth: 1.6,
      fill: true,
      tension: 0.32,
      pointRadius: 0,
      pointHoverRadius: 3.5,
      pointHoverBackgroundColor: BRAND,
      pointHoverBorderColor: '#eef4fa',
      pointHoverBorderWidth: 1,
    },
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
            `净变化 ${p.net > 0 ? '+' : ''}${p.net}`,
            `加分 +${p.add} / 减分 ${Math.abs(p.deduct)}`,
            `操作 ${p.count} 次`,
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
      // 0 基准线加粗高亮，其余网格线淡
      grid: {
        color: (ctx: any) => (ctx.tick?.value === 0 ? ZERO_LINE : GRID),
      },
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
    <Line :data="chartData" :options="chartOptions" />
  </div>
</template>
