<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { MailService } from '~/types'
import { useToast } from '~/composables/useToast'
import ServiceModal from '~/components/mail/ServiceModal.vue'

definePageMeta({ layout: 'superadmin' })

const toast = useToast()
const services = ref<MailService[]>([])
const loading = ref(false)
const modalOpen = ref(false)
const editing = ref<MailService | null>(null)
const providerLabels: Record<string, string> = {
  qq: 'QQ 邮箱', '163': '163 邮箱', gmail: 'Gmail', outlook: 'Outlook', aliyun: '阿里云邮箱', custom: '自定义',
}

async function load() {
  loading.value = true
  try {
    const res = await $fetch<{ data: MailService[] }>('/api/mail-services')
    services.value = res.data
  } catch (err: any) {
    toast.error(err?.data?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  modalOpen.value = true
}
function openEdit(s: MailService) {
  editing.value = s
  modalOpen.value = true
}

async function toggleEnabled(s: MailService) {
  const next = s.enabled === 1 ? 0 : 1
  try {
    await $fetch(`/api/mail-services/${s.id}`, { method: 'PATCH', body: { enabled: next } })
    s.enabled = next
    toast.success(next === 1 ? '已启用' : '已禁用')
  } catch (err: any) {
    toast.error(err?.data?.message || '操作失败')
  }
}

async function remove(s: MailService) {
  if (!window.confirm(`确定删除邮件服务「${s.name}」？此操作不可撤销。`)) return
  try {
    await $fetch(`/api/mail-services/${s.id}`, { method: 'DELETE' })
    services.value = services.value.filter((x) => x.id !== s.id)
    toast.success('已删除')
  } catch (err: any) {
    toast.error(err?.data?.message || '删除失败')
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="page-title">邮件服务</h1>
        <p class="page-sub">配置多个邮件服务，发送时按优先级从高到低依次尝试（0 为最高优先级，数值越大优先级越低）。高优先级服务发送失败时，自动降级到下一优先级。</p>
      </div>
      <button class="btn btn-primary" @click="openCreate">+ 添加邮件服务</button>
    </div>

    <div v-if="loading" class="text-slate-400 text-sm">加载中...</div>

    <div v-else-if="services.length === 0" class="empty-state">
      <p class="text-slate-400">尚未配置任何邮件服务。</p>
      <button class="btn btn-ghost mt-3" @click="openCreate">添加第一个邮件服务</button>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      <div v-for="s in services" :key="s.id" class="service-card" :class="{ 'is-disabled': s.enabled === 0 }">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h3 class="card-name truncate">{{ s.name }}</h3>
            <span class="badge">{{ providerLabels[s.provider] || s.provider }}</span>
          </div>
          <label class="switch" :title="s.enabled === 1 ? '已启用' : '已禁用'">
            <input type="checkbox" :checked="s.enabled === 1" @change="toggleEnabled(s)" />
            <span class="slider"></span>
          </label>
        </div>

        <div class="meta">
          <div><span class="meta-k">优先级</span><span class="meta-v">{{ s.priority }}{{ s.priority === 0 ? '（最高）' : '' }}</span></div>
          <div><span class="meta-k">服务器</span><span class="meta-v">{{ s.host }}:{{ s.port }}</span></div>
          <div><span class="meta-k">安全</span><span class="meta-v uppercase">{{ s.secure }}</span></div>
          <div><span class="meta-k">发件人</span><span class="meta-v truncate">{{ s.fromAddress || '—' }}</span></div>
        </div>

        <div class="actions">
          <button class="btn btn-ghost btn-sm" @click="openEdit(s)">编辑</button>
          <button class="btn btn-danger btn-sm" @click="remove(s)">删除</button>
        </div>
      </div>
    </div>

    <ServiceModal :open="modalOpen" :service="editing" @close="modalOpen = false" @saved="load" />
  </div>
</template>

<style scoped>
.page-title { font-size: 22px; font-weight: 700; color: #e2e8f0; margin: 0; }
.page-sub { font-size: 13px; color: #94a3b8; margin: 6px 0 0; max-width: 760px; line-height: 1.6; }
.empty-state { border: 1px dashed rgba(74,122,181,0.35); border-radius: 16px; padding: 48px; text-align: center; }

.service-card {
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid rgba(74, 122, 181, 0.22);
  border-radius: 16px; padding: 18px;
  display: flex; flex-direction: column; gap: 14px;
  transition: transform .2s ease, border-color .2s ease;
}
.service-card:hover { transform: translateY(-2px); border-color: rgba(74,122,181,0.5); }
.service-card.is-disabled { opacity: .55; }

.card-name { font-size: 16px; font-weight: 600; color: #e2e8f0; margin: 0 0 6px; }
.badge { display: inline-block; font-size: 11px; padding: 2px 8px; border-radius: 999px; background: rgba(74,122,181,0.18); color: #8fb3dc; }

.meta { display: flex; flex-direction: column; gap: 6px; font-size: 13px; }
.meta > div { display: flex; gap: 8px; }
.meta-k { color: #64748b; width: 48px; flex-shrink: 0; }
.meta-v { color: #cbd5e1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.actions { display: flex; gap: 8px; padding-top: 4px; border-top: 1px solid rgba(148,163,184,0.12); }

/* toggle switch */
.switch { position: relative; display: inline-block; width: 40px; height: 22px; flex-shrink: 0; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; cursor: pointer; inset: 0; background: #334155; border-radius: 999px; transition: .2s; }
.slider::before { content: ''; position: absolute; height: 16px; width: 16px; left: 3px; bottom: 3px; background: #cbd5e1; border-radius: 50%; transition: .2s; }
.switch input:checked + .slider { background: #4a7ab5; }
.switch input:checked + .slider::before { transform: translateX(18px); background: #fff; }
</style>
