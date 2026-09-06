<script setup lang="ts">
/**
 * 总体加扣分条形图（纯 HTML/CSS，无 Canvas / 无 Chart.js 实例）
 *
 * 「上下拼接」发散条形图：
 *  - 统一零点横线居中
 *  - 加分（红）自零线向上延伸
 *  - 扣分（绿）自零线向下延伸
 * 遵循中国市场惯例「红涨绿跌」。
 */
interface BarItem {
  label: string
  add: number
  deduct: number
}

const props = withDefaults(defineProps<{
  items: BarItem[]
  height?: number
}>(), {
  height: 180,
})

const ADD = '#f87171'    // 加分 → 红（向上）
const DEDUCT = '#34d399' // 扣分 → 绿（向下）

const bars = computed(() => {
  const items = props.items || []
  const maxVal = Math.max(1, ...items.map(i => Math.max(i.add, i.deduct)))
  // 上下各留 18px：16px 让位给数值标签，2px 间距
  const scale = (props.height / 2 - 18) / maxVal
  return items.map(it => ({
    label: it.label,
    add: it.add,
    deduct: it.deduct,
    addH: Math.max(0, it.add * scale),
    dedH: Math.max(0, it.deduct * scale),
  }))
})
</script>

<template>
  <div class="w-full">
    <div class="flex items-center gap-4 justify-end mb-2 text-[11px] text-slate-500">
      <span class="flex items-center gap-1.5"><i class="w-2.5 h-2.5 inline-block rounded-sm" style="background:#f87171"></i>加分</span>
      <span class="flex items-center gap-1.5"><i class="w-2.5 h-2.5 inline-block rounded-sm" style="background:#34d399"></i>扣分</span>
    </div>

    <!-- 条形区 -->
    <div class="relative w-full overflow-visible" :style="{ height: `${height}px` }">
      <!-- 统一零点横线 -->
      <div class="absolute left-0 right-0 border-t border-slate-500/50" style="top: 50%"></div>

      <div class="flex h-full">
        <div v-for="(b, i) in bars" :key="i" class="relative flex-1 min-w-0">
          <!-- 加分：自零线向上 -->
          <div
            v-if="b.add > 0"
            class="absolute left-1/2 -translate-x-1/2 rounded-t"
            :style="{ bottom: '50%', height: `${b.addH}px`, width: 'min(32px, 60%)', background: ADD }"
            :title="`${b.label} 加分 +${b.add} / 扣分 -${b.deduct}`"
          ></div>
          <!-- 扣分：自零线向下 -->
          <div
            v-if="b.deduct > 0"
            class="absolute left-1/2 -translate-x-1/2 rounded-b"
            :style="{ top: '50%', height: `${b.dedH}px`, width: 'min(32px, 60%)', background: DEDUCT }"
            :title="`${b.label} 加分 +${b.add} / 扣分 -${b.deduct}`"
          ></div>

          <!-- 加分数值：紧贴红柱顶端上方 -->
          <div
            v-if="b.add > 0"
            class="absolute left-0 right-0 text-center text-[10px] font-medium leading-none tabular-nums whitespace-nowrap pointer-events-none"
            :style="{ bottom: `calc(50% + ${b.addH + 2}px)`, color: ADD }"
          >+{{ b.add }}</div>
          <!-- 扣分数值：紧贴绿柱底端下方 -->
          <div
            v-if="b.deduct > 0"
            class="absolute left-0 right-0 text-center text-[10px] font-medium leading-none tabular-nums whitespace-nowrap pointer-events-none"
            :style="{ top: `calc(50% + ${b.dedH + 2}px)`, color: DEDUCT }"
          >-{{ b.deduct }}</div>
        </div>
      </div>
    </div>

    <!-- 维度标签 -->
    <div class="flex mt-1">
      <div v-for="(b, i) in bars" :key="i" class="flex-1 min-w-0 text-center text-[11px] text-slate-500 truncate px-0.5">{{ b.label }}</div>
    </div>
  </div>
</template>
