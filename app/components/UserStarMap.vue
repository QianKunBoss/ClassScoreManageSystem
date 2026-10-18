<script setup lang="ts">
import { computed } from 'vue'
import type { StarNode } from '~/types'

/**
 * 用户星图：以当前用户为圆心，按层级向外生长。
 * 纯 SVG 径向布局，无渐变；节点可点击展开、可右键管理。
 */
const props = withDefaults(defineProps<{
  root: StarNode
  /** 已展开的节点 id 集合（由页面持有） */
  expanded?: Set<string>
}>(), {
  expanded: () => new Set<string>(),
})

const emit = defineEmits<{
  toggle: [id: string]
  menu: [payload: { node: StarNode; event: MouseEvent }]
}>()

// 各层级半径
const RING = [0, 150, 280, 410, 540]
// 画布留白（容纳标签）
const PAD = 120

interface Placed {
  node: StarNode
  depth: number
  x: number
  y: number
  parentId: string | null
}

function visibleChildren(n: StarNode): StarNode[] {
  return n.children?.length && props.expanded.has(n.id) ? n.children : []
}

function leafCount(n: StarNode): number {
  const kids = visibleChildren(n)
  if (!kids.length) return 1
  return kids.reduce((sum, k) => sum + leafCount(k), 0)
}

const placed = computed<Placed[]>(() => {
  const out: Placed[] = []

  const walk = (node: StarNode, depth: number, a0: number, a1: number, parentId: string | null) => {
    const angle = (a0 + a1) / 2
    const r = RING[Math.min(depth, RING.length - 1)]
    out.push({ node, depth, parentId, x: Math.cos(angle) * r, y: Math.sin(angle) * r })

    const kids = visibleChildren(node)
    if (!kids.length) return

    // 根节点的直接子节点（学生/管理员）均分整圆，其余按叶子数分配扇区
    const weights = kids.map((k) => (depth === 0 ? 1 : leafCount(k)))
    const total = weights.reduce((a, b) => a + b, 0) || 1
    let cursor = a0
    kids.forEach((k, i) => {
      const span = (a1 - a0) * (weights[i] / total)
      walk(k, depth + 1, cursor, cursor + span, node.id)
      cursor += span
    })
  }

  // 从正上方开始，管理员占右半圈、学生占左半圈
  walk(props.root, 0, -Math.PI / 2, Math.PI * 1.5, null)
  return out
})

const positions = computed(() => new Map(placed.value.map((p) => [p.node.id, p])))

const edges = computed(() => placed.value
  .filter((p) => p.parentId)
  .map((p) => {
    const parent = positions.value.get(p.parentId!)
    return { id: p.node.id, depth: p.depth, x1: parent?.x ?? 0, y1: parent?.y ?? 0, x2: p.x, y2: p.y }
  }))

const extent = computed(() => {
  const maxR = placed.value.reduce((m, p) => Math.max(m, Math.hypot(p.x, p.y)), 0)
  return Math.ceil(maxR + PAD)
})

interface Tone { fill: string; stroke: string; text: string }
const TONES: Record<string, Tone> = {
  brand: { fill: '#152537', stroke: '#4a7ab5', text: '#d7e6f7' },
  emerald: { fill: '#0f2620', stroke: '#34d399', text: '#c6efe1' },
  muted: { fill: '#111a27', stroke: '#2b3b52', text: '#a9b8cc' },
  warning: { fill: '#2a2113', stroke: '#d97706', text: '#f0d6a6' },
}

function toneOf(node: StarNode): Tone {
  if (node.disabled) return TONES.warning
  return TONES[node.tone || 'muted']
}

function radiusOf(p: Placed): number {
  switch (p.node.kind) {
    case 'root': return 23
    case 'group': return 15
    case 'school': return 12
    case 'role': return 9
    case 'admin': return 7
    case 'class': return 8
    default: return 4.5
  }
}

function labelDy(p: Placed): number {
  return radiusOf(p) + (p.depth <= 1 ? 17 : 13)
}

function fontSizeOf(p: Placed): number {
  switch (p.node.kind) {
    case 'root': return 13
    case 'group': return 12
    case 'school': return 11
    case 'student': return 9
    default: return 10
  }
}

function toggle(node: StarNode) {
  if (node.children?.length) emit('toggle', node.id)
}

const MENU_KINDS = new Set(['school', 'admin', 'student'])

function onContextMenu(e: MouseEvent, node: StarNode) {
  if (!MENU_KINDS.has(node.kind) || !node.meta) return
  e.preventDefault()
  e.stopPropagation()
  emit('menu', { node, event: e })
}
</script>

<template>
  <svg
    class="star-map"
    :viewBox="`${-extent} ${-extent} ${extent * 2} ${extent * 2}`"
    :width="extent * 2"
    :height="extent * 2"
    role="img"
    aria-label="用户星图"
  >
    <g class="star-edges">
      <line
        v-for="e in edges"
        :key="'edge-' + e.id"
        :x1="e.x1"
        :y1="e.y1"
        :x2="e.x2"
        :y2="e.y2"
        :stroke-width="e.depth <= 2 ? 1.4 : 1"
      />
    </g>

    <g
      v-for="(p, i) in placed"
      :key="p.node.id"
      class="star-node"
      :class="[
        `star-node--${p.node.kind}`,
        { 'is-disabled': p.node.disabled, 'is-clickable': !!p.node.children?.length },
      ]"
      :style="{ animationDelay: Math.min(i * 12, 320) + 'ms' }"
      :data-star-root="p.depth === 0 ? '1' : undefined"
      @click="toggle(p.node)"
      @contextmenu="onContextMenu($event, p.node)"
    >
      <circle
        :cx="p.x"
        :cy="p.y"
        :r="radiusOf(p)"
        :fill="toneOf(p.node).fill"
        :stroke="toneOf(p.node).stroke"
        :stroke-width="p.depth === 0 ? 2 : 1.2"
      />
      <text
        :x="p.x"
        :y="p.y + labelDy(p)"
        :font-size="fontSizeOf(p)"
        :fill="toneOf(p.node).text"
        text-anchor="middle"
      >{{ p.node.label }}</text>
      <text
        v-if="p.node.sub"
        :x="p.x"
        :y="p.y + labelDy(p) + 11"
        :font-size="9"
        fill="#64758e"
        text-anchor="middle"
      >{{ p.node.sub }}</text>
      <title>{{ p.node.label }}{{ p.node.sub ? ' · ' + p.node.sub : '' }}</title>
    </g>
  </svg>
</template>

<style scoped>
.star-map {
  display: block;
  overflow: visible;
  font-family: inherit;
}
.star-edges line {
  stroke: rgba(110, 140, 180, 0.22);
}
.star-node {
  transform-box: fill-box;
  transform-origin: center;
  animation: star-in 0.34s cubic-bezier(0.22, 0.61, 0.36, 1) both;
}
.star-node.is-clickable {
  cursor: pointer;
}
.star-node.is-disabled {
  opacity: 0.55;
}
@keyframes star-in {
  from {
    opacity: 0;
    transform: scale(0.55);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .star-node {
    animation: none;
  }
}
</style>
