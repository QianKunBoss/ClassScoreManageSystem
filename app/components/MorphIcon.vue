<script setup lang="ts">
import { computed } from 'vue'
import { MorphIcon as BaseMorphIcon } from 'morphicons/vue'
import type { IconInput } from 'morphicons/vue'
import { iconRegistry } from '~/utils/icons'

// 统一图标封装：morphicons/vue 透传 class/style/aria-* 到根 <svg>，
// 颜色用 currentColor 以便 Tailwind 文字色（text-brand-400 等）接管。
// 支持两种用法：:icon="数据" 或 name="注册名"（从 iconRegistry 解析）。
const props = withDefaults(defineProps<{
  icon?: IconInput
  name?: string
  size?: number | string
  strokeWidth?: number | string
  color?: string
  spring?: 'smooth' | 'snappy' | 'bouncy'
  reducedMotion?: 'never' | 'user' | 'always'
  label?: string
}>(), {
  size: 20,
  strokeWidth: 1.75,
  color: 'currentColor',
  spring: 'snappy',
  reducedMotion: 'user',
})

const resolved = computed<IconInput>(() => {
  if (props.name) return (iconRegistry[props.name] ?? props.icon ?? 'X') as IconInput
  return (props.icon ?? 'X') as IconInput
})
</script>

<template>
  <BaseMorphIcon
    :icon="resolved"
    :size="size"
    :stroke-width="strokeWidth"
    :color="color"
    :spring="spring"
    :reduced-motion="reducedMotion"
    :label="label"
  />
</template>
