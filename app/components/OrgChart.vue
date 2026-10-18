<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { OrgNode } from '~/types'

/**
 * 组织结构图：自上而下生长。
 * 采用「计算布局 + SVG 连线 + 逐帧插值」，展开/收起时节点与连线一起平滑移动，
 * 单子节点时连线为一条直线（不会出现 CSS 伪元素方案的错位）。
 */
const props = withDefaults(defineProps<{
  node: OrgNode
  /** 已收起的节点 id 集合（由页面持有） */
  collapsed?: Set<string>
}>(), {
  collapsed: () => new Set<string>(),
})

const emit = defineEmits<{
  toggle: [id: string]
  menu: [payload: { node: OrgNode; event: MouseEvent }]
}>()

const KIND_LABEL: Record<OrgNode['kind'], string> = {
  root: '系统',
  school: '学校',
  grade: '年级',
  class: '班级',
}

// 固定节点尺寸（配合省略号，避免布局随文字抖动）
const NODE_W: Record<OrgNode['kind'], number> = { root: 216, school: 164, grade: 136, class: 116 }
const NODE_H: Record<OrgNode['kind'], number> = { root: 72, school: 68, grade: 62, class: 54 }
const GAP_X = 22
const LEVEL_STEP = 156
const PAD = 20

interface Placed {
  node: OrgNode
  x: number
  y: number
  w: number
  h: number
  depth: number
  parentId: string | null
}

function childrenOf(n: OrgNode): OrgNode[] {
  return n.children?.length && !props.collapsed.has(n.id) ? n.children : []
}

function computeLayout(root: OrgNode): Placed[] {
  const widths = new Map<string, number>()

  const measure = (n: OrgNode): number => {
    const kids = childrenOf(n)
    const own = NODE_W[n.kind]
    if (!kids.length) {
      widths.set(n.id, own)
      return own
    }
    const sum = kids.reduce((s, k) => s + measure(k), 0) + GAP_X * (kids.length - 1)
    const w = Math.max(own, sum)
    widths.set(n.id, w)
    return w
  }
  measure(root)

  const out: Placed[] = []
  const place = (n: OrgNode, left: number, depth: number, parentId: string | null) => {
    const subtree = widths.get(n.id) || NODE_W[n.kind]
    const w = NODE_W[n.kind]
    const h = NODE_H[n.kind]
    out.push({
      node: n,
      x: left + (subtree - w) / 2,
      y: PAD + depth * LEVEL_STEP,
      w,
      h,
      depth,
      parentId,
    })

    const kids = childrenOf(n)
    if (!kids.length) return
    const kidsWidth = kids.reduce((s, k) => s + (widths.get(k.id) || NODE_W[k.kind]), 0) + GAP_X * (kids.length - 1)
    let cursor = left + (subtree - kidsWidth) / 2
    for (const k of kids) {
      place(k, cursor, depth + 1, n.id)
      cursor += (widths.get(k.id) || NODE_W[k.kind]) + GAP_X
    }
  }

  place(root, PAD, 0, null)
  return out
}

/** 目标布局（决定画布尺寸与节点增删） */
const target = computed<Placed[]>(() => computeLayout(props.node))

/** 当前渲染位置（布局变化时按缓动插值过渡） */
const view = ref<Placed[]>([])
let raf = 0

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const MOVE_MS = 500

watch(target, (next) => {
  const prev = view.value
  if (!prev.length || !next.length) {
    view.value = next
    return
  }

  const prevMap = new Map(prev.map((p) => [p.node.id, p]))
  const from = new Map<string, { x: number; y: number }>()
  for (const p of next) {
    const old = prevMap.get(p.node.id)
    if (old) {
      from.set(p.node.id, { x: old.x, y: old.y })
    } else {
      // 新节点从父节点旧位置展开出来
      const parentOld = p.parentId ? prevMap.get(p.parentId) : null
      from.set(p.node.id, parentOld ? { x: parentOld.x, y: parentOld.y } : { x: p.x, y: p.y })
    }
  }

  cancelAnimationFrame(raf)
  const startTs = performance.now()

  const frame = (now: number) => {
    const t = Math.min(1, (now - startTs) / MOVE_MS)
    const e = easeInOutCubic(t)
    view.value = next.map((p) => {
      const f = from.get(p.node.id) || p
      return { ...p, x: f.x + (p.x - f.x) * e, y: f.y + (p.y - f.y) * e }
    })
    if (t < 1) raf = requestAnimationFrame(frame)
  }

  raf = requestAnimationFrame(frame)
}, { immediate: true })

onBeforeUnmount(() => cancelAnimationFrame(raf))

const width = computed(() => Math.max(...target.value.map((p) => p.x + p.w), 0) + PAD)
const height = computed(() => Math.max(...target.value.map((p) => p.y + p.h), 0) + PAD)

interface Edge { id: string; d: string; depth: number }

const edges = computed<Edge[]>(() => {
  const map = new Map(view.value.map((p) => [p.node.id, p]))
  const out: Edge[] = []

  for (const p of view.value) {
    if (!p.parentId) continue
    const parent = map.get(p.parentId)
    if (!parent) continue
    const x1 = parent.x + parent.w / 2
    const y1 = parent.y + parent.h
    const x2 = p.x + p.w / 2
    const y2 = p.y
    const mid = y1 + (y2 - y1) / 2

    // 单子节点且中心对齐 → 一条直线；否则肘形折线
    const d = Math.abs(x1 - x2) < 0.5
      ? `M ${x1} ${y1} V ${y2}`
      : `M ${x1} ${y1} V ${mid} H ${x2} V ${y2}`
    out.push({ id: p.node.id, d, depth: p.depth })
  }
  return out
})

function hasChildren(n: OrgNode) {
  return !!n.children?.length
}

function isCollapsed(n: OrgNode) {
  return props.collapsed.has(n.id)
}

function onClick(n: OrgNode) {
  if (hasChildren(n)) emit('toggle', n.id)
}

/** Root 之外的组织节点都支持右键菜单（学校/年级/班级） */
function onContextMenu(e: MouseEvent, n: OrgNode) {
  if (n.kind === 'root') return
  e.preventDefault()
  e.stopPropagation()
  emit('menu', { node: n, event: e })
}
</script>

<template>
  <div class="org-tree" :style="{ width: width + 'px', height: height + 'px' }">
    <svg class="org-links" :width="width" :height="height" aria-hidden="true">
      <path
        v-for="e in edges"
        :key="'edge-' + e.id"
        :d="e.d"
        fill="none"
        :stroke-width="e.depth <= 1 ? 1.4 : 1"
      />
    </svg>

    <component
      :is="hasChildren(p.node) ? 'button' : 'div'"
      v-for="p in view"
      :key="p.node.id"
      :type="hasChildren(p.node) ? 'button' : undefined"
      class="org-node"
      :class="[
        `org-node--${p.node.kind}`,
        { 'is-disabled': p.node.disabled, 'is-collapsed': isCollapsed(p.node) },
      ]"
      :style="{ transform: `translate(${p.x}px, ${p.y}px)`, width: p.w + 'px', height: p.h + 'px' }"
      :data-org-root="p.depth === 0 ? '1' : undefined"
      @click="onClick(p.node)"
      @contextmenu="onContextMenu($event, p.node)"
    >
      <span class="org-kind">{{ KIND_LABEL[p.node.kind] }}</span>
      <span class="org-label">{{ p.node.label }}</span>
      <span class="org-meta">
        <span v-if="p.node.sub" class="org-sub">{{ p.node.sub }}</span>
        <span v-if="hasChildren(p.node)" class="org-count">
          <svg viewBox="0 0 12 12" width="9" height="9" class="org-chevron" aria-hidden="true">
            <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          {{ p.node.children?.length || 0 }}
        </span>
      </span>
    </component>
  </div>
</template>

<style scoped>
.org-tree {
  position: relative;
}

.org-links {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}
.org-links path {
  stroke: #26374f;
}

.org-node {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 2px;
  box-sizing: border-box;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid #223148;
  background: #0e1624;
  text-align: left;
  font-family: inherit;
  overflow: hidden;
  cursor: default;
  will-change: transform;
  animation: org-node-in 0.26s ease both;
  transition: border-color 0.15s ease, background 0.15s ease;
}
button.org-node { cursor: pointer; }
button.org-node:hover { border-color: #355072; background: #121d2e; }
button.org-node:focus-visible { outline: 2px solid #4a7ab5; outline-offset: 2px; }

.org-node--root {
  border-color: #3a5f8c;
  background: #12202f;
}
.org-node--school { border-color: #2c405c; }
.org-node--grade { background: #0c1420; }
.org-node--class { background: #0a111b; border-color: #1b2739; }

.org-node.is-disabled { opacity: 0.55; border-style: dashed; }

.org-kind {
  font-size: 9px;
  line-height: 1;
  letter-spacing: 0.1em;
  color: #64758e;
}
.org-node--root .org-kind { color: #8fb0d6; }

.org-label {
  max-width: 100%;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.25;
  color: #dbe5f2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.org-node--root .org-label { font-size: 15px; color: #d6e5f7; }
.org-node--class .org-label { font-size: 12px; font-weight: 500; color: #bccbdd; }

.org-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  font-size: 10px;
  line-height: 1.2;
  color: #6b7c95;
  overflow: hidden;
}
.org-sub {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.org-count {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  padding: 1px 5px;
  border-radius: 999px;
  border: 1px solid #23344b;
  color: #8b99b0;
  font-variant-numeric: tabular-nums;
}
.org-chevron { transition: transform 0.18s ease; flex-shrink: 0; }
.org-node.is-collapsed .org-chevron { transform: rotate(-90deg); }

@keyframes org-node-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .org-node { animation: none; }
  .org-chevron { transition: none; }
}
</style>
