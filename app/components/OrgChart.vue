<script setup lang="ts">
import { computed } from 'vue'
import type { OrgNode } from '~/types'

const props = withDefaults(defineProps<{
  node: OrgNode
  /** 已收起的节点 id 集合（由页面持有，递归共享） */
  collapsed?: Set<string>
}>(), {
  collapsed: () => new Set<string>(),
})

const emit = defineEmits<{ toggle: [id: string] }>()

const KIND_LABEL: Record<OrgNode['kind'], string> = {
  root: '系统',
  school: '学校',
  grade: '年级',
  class: '班级',
}

const hasChildren = computed(() => !!props.node.children?.length)
const isCollapsed = computed(() => props.collapsed.has(props.node.id))
const visibleChildren = computed(() => (isCollapsed.value ? [] : props.node.children || []))
const kindLabel = computed(() => KIND_LABEL[props.node.kind])

function toggle() {
  if (hasChildren.value) emit('toggle', props.node.id)
}
</script>

<template>
  <div class="org-branch">
    <component
      :is="hasChildren ? 'button' : 'div'"
      :type="hasChildren ? 'button' : undefined"
      class="org-node"
      :class="[`org-node--${node.kind}`, { 'is-disabled': node.disabled, 'is-collapsed': isCollapsed }]"
      @click="toggle"
    >
      <span class="org-kind">{{ kindLabel }}</span>
      <span class="org-label">{{ node.label }}</span>
      <span class="org-meta">
        <span v-if="node.sub" class="org-sub">{{ node.sub }}</span>
        <span v-if="hasChildren" class="org-count">
          <svg viewBox="0 0 12 12" width="9" height="9" class="org-chevron" aria-hidden="true">
            <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          {{ node.children!.length }}
        </span>
      </span>
    </component>

    <ul v-if="visibleChildren.length" class="org-children">
      <li v-for="child in visibleChildren" :key="child.id">
        <OrgChart :node="child" :collapsed="collapsed" @toggle="emit('toggle', $event)" />
      </li>
    </ul>
  </div>
</template>

<style scoped>
.org-branch {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.org-node {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid #223148;
  background: #0e1624;
  text-align: left;
  font-family: inherit;
  cursor: default;
  transition: border-color 0.15s ease, background 0.15s ease;
}
button.org-node { cursor: pointer; }
button.org-node:hover { border-color: #355072; background: #121d2e; }
button.org-node:focus-visible { outline: 2px solid #4a7ab5; outline-offset: 2px; }

.org-node--root {
  padding: 10px 16px;
  border-color: #3a5f8c;
  background: #12202f;
}
.org-node--school { border-color: #2c405c; }
.org-node--grade { padding: 7px 11px; background: #0c1420; }
.org-node--class { padding: 6px 10px; background: #0a111b; border-color: #1b2739; }

.org-node.is-disabled { opacity: 0.55; border-style: dashed; }

.org-kind {
  font-size: 9px;
  line-height: 1;
  letter-spacing: 0.1em;
  color: #64758e;
}
.org-node--root .org-kind { color: #8fb0d6; }

.org-label {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.25;
  color: #dbe5f2;
  white-space: nowrap;
}
.org-node--root .org-label { font-size: 15px; color: #d6e5f7; }
.org-node--class .org-label { font-size: 12px; font-weight: 500; color: #bccbdd; }

.org-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  line-height: 1.2;
  color: #6b7c95;
}
.org-sub { white-space: nowrap; }
.org-count {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 5px;
  border-radius: 999px;
  border: 1px solid #23344b;
  color: #8b99b0;
  font-variant-numeric: tabular-nums;
}
.org-chevron { transition: transform 0.18s ease; }
.org-node.is-collapsed .org-chevron { transform: rotate(-90deg); }

/* ===== 连接线（自上而下） ===== */
.org-children {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  margin: 0;
  padding: 26px 0 0;
  list-style: none;
}
/* 父节点 → 横向分支 的竖线 */
.org-children::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  width: 1px;
  height: 26px;
  background: #26374f;
}
.org-children > li {
  position: relative;
  display: flex;
  justify-content: center;
  padding: 26px 7px 0;
}
/* 横线（左半 / 右半）与下落竖线 */
.org-children > li::before,
.org-children > li::after {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  width: 50%;
  height: 26px;
  border-top: 1px solid #26374f;
}
.org-children > li::before { left: 0; }
.org-children > li::after { border-left: 1px solid #26374f; }

/* 首个兄弟不要左半边尾巴；末尾兄弟不要右半边尾巴，改由左半边的右边框下落 */
.org-children > li:first-child::before { border-top-color: transparent; }
.org-children > li:last-child::after { border-top-color: transparent; border-left-color: transparent; }
.org-children > li:last-child::before { border-right: 1px solid #26374f; }

@media (prefers-reduced-motion: reduce) {
  .org-node, .org-chevron { transition: none; }
}
</style>
