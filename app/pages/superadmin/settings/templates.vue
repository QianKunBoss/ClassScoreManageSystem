<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { MailTemplate } from '~/types'
import { useToast } from '~/composables/useToast'
import { renderTemplate, sampleValueFor } from '~/utils/template'

definePageMeta({ layout: 'superadmin' })

// 占位符示例（避免模板里直接写 {{ 被 Vue 当成插值）
const demoVar = '{{变量名}}'
const demoCode = '{{code}}'

const toast = useToast()
const list = ref<MailTemplate[]>([])
const loading = ref(false)
const selected = ref<MailTemplate | null>(null)
const saving = ref(false)

// 编辑态副本
const draft = ref<{ id?: number; slug: string; name: string; subject: string; bodyHtml: string; variablesRaw: string }>(
  { slug: '', name: '', subject: '', bodyHtml: '', variablesRaw: '' },
)
const isNew = ref(false)

const variableKeys = computed(() => {
  try {
    const arr = JSON.parse(selected.value?.variables || '[]')
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
})

// 预览用的示例变量值（按变量名生成）
const sampleVars = computed<Record<string, string>>(() => {
  const out: Record<string, string> = {}
  for (const k of variableKeys.value) out[k] = sampleValueFor(k)
  return out
})

const previewSubject = computed(() => renderTemplate(draft.value.subject, sampleVars.value))
const previewHtml = computed(() => renderTemplate(draft.value.bodyHtml, sampleVars.value))

async function load() {
  loading.value = true
  try {
    const res = await $fetch<{ data: MailTemplate[] }>('/api/mail-templates')
    list.value = res.data
    if (list.value.length && !selected.value) select(list.value[0])
  } catch (err: any) {
    toast.error(err?.data?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function select(t: MailTemplate) {
  selected.value = t
  isNew.value = false
  draft.value = {
    id: t.id,
    slug: t.slug,
    name: t.name,
    subject: t.subject,
    bodyHtml: t.bodyHtml,
    variablesRaw: (() => {
      try { return (JSON.parse(t.variables || '[]') as string[]).join(', ') } catch { return '' }
    })(),
  }
}

function createNew() {
  selected.value = null
  isNew.value = true
  draft.value = { slug: '', name: '', subject: '', bodyHtml: '', variablesRaw: '' }
}

async function save() {
  if (!draft.value.name.trim()) { toast.error('请填写模板名称'); return }
  if (isNew.value && !draft.value.slug.trim()) { toast.error('请填写模板标识（slug）'); return }
  if (isNew.value && !/^[\w-]+$/.test(draft.value.slug.trim())) { toast.error('标识只能含字母、数字、下划线、连字符'); return }

  const variables = draft.value.variablesRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const body = {
    name: draft.value.name.trim(),
    slug: draft.value.slug.trim(),
    subject: draft.value.subject,
    bodyHtml: draft.value.bodyHtml,
    variables,
  }
  saving.value = true
  try {
    if (isNew.value) {
      const res = await $fetch<{ data: MailTemplate }>('/api/mail-templates', { method: 'POST', body })
      toast.success('模板已创建')
      await load()
      select(res.data)
    } else {
      await $fetch(`/api/mail-templates/${draft.value.id}`, { method: 'PATCH', body: { name: body.name, subject: body.subject, bodyHtml: body.bodyHtml, variables } })
      toast.success('已保存')
      await load()
      // 重新选中同一模板
      const refreshed = list.value.find((t) => t.id === draft.value.id)
      if (refreshed) select(refreshed)
    }
  } catch (err: any) {
    toast.error(err?.data?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!selected.value) return
  if (!window.confirm(`确定删除模板「${selected.value.name}」？`)) return
  try {
    await $fetch(`/api/mail-templates/${selected.value.id}`, { method: 'DELETE' })
    toast.success('已删除')
    selected.value = null
    await load()
  } catch (err: any) {
    toast.error(err?.data?.message || '删除失败')
  }
}

// ===== 验证码模板测试（发码 / 验码）=====
const isVerificationTemplate = computed(() => draft.value.slug === 'verification_code')
const testEmail = ref('')
const testCode = ref('')
const testSending = ref(false)
const testVerifying = ref(false)
const testMsg = ref('')
const testOk = ref<boolean | null>(null)
const devCode = ref('')

async function sendTestCode() {
  if (!testEmail.value.trim()) { toast.error('请填写测试邮箱'); return }
  testSending.value = true
  testMsg.value = ''
  testOk.value = null
  devCode.value = ''
  try {
    const res = await $fetch<{ success: boolean; message: string; dev?: boolean; code?: string }>(
      '/api/mail-templates/test-verification-code',
      { method: 'POST', body: { to: testEmail.value.trim(), subject: draft.value.subject, bodyHtml: draft.value.bodyHtml } },
    )
    testOk.value = res.success
    testMsg.value = res.message
    if (res.dev) devCode.value = res.code || ''
    res.success ? toast.success('已发送测试验证码') : toast.error(res.message)
  } catch (err: any) {
    testOk.value = false
    testMsg.value = err?.data?.message || '发送失败'
    toast.error(testMsg.value)
  } finally {
    testSending.value = false
  }
}

async function verifyTestCode() {
  if (!testEmail.value.trim() || !testCode.value.trim()) { toast.error('请填写测试邮箱与验证码'); return }
  testVerifying.value = true
  testMsg.value = ''
  testOk.value = null
  try {
    const res = await $fetch<{ ok: boolean; message: string }>(
      '/api/mail-templates/verify-verification-code',
      { method: 'POST', body: { email: testEmail.value.trim(), code: testCode.value.trim() } },
    )
    testOk.value = res.ok
    testMsg.value = res.message
    res.ok ? toast.success('验证通过') : toast.error(res.message)
  } catch (err: any) {
    testOk.value = false
    testMsg.value = err?.data?.message || '验证失败'
    toast.error(testMsg.value)
  } finally {
    testVerifying.value = false
  }
}

watch(() => draft.value.variablesRaw, () => {
  // 变量列表变化时，仅刷新预览（computed 已处理），无需额外逻辑
})

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="page-title">邮件模板</h1>
      <p class="page-sub">在线编辑发件模板，使用 <code class="code">{{ demoVar }}</code> 作为占位符（如 <code class="code">{{ demoCode }}</code>）。编辑时右侧实时预览渲染效果。</p>
    </div>

    <div class="layout">
      <!-- 模板列表 -->
      <aside class="panel list-panel">
        <div class="flex items-center justify-between mb-3">
          <span class="panel-title">模板列表</span>
          <button class="btn btn-ghost btn-sm" @click="createNew">+ 新建</button>
        </div>
        <div v-if="loading" class="text-slate-400 text-sm">加载中...</div>
        <ul v-else class="space-y-1">
          <li
            v-for="t in list"
            :key="t.id"
            class="list-item"
            :class="{ active: selected?.id === t.id && !isNew }"
            @click="select(t)"
          >
            <div class="li-name">{{ t.name }}</div>
            <div class="li-slug">{{ t.slug }}</div>
          </li>
          <li v-if="isNew" class="list-item active">
            <div class="li-name">未命名模板</div>
            <div class="li-slug">新模板</div>
          </li>
        </ul>
      </aside>

      <!-- 编辑区 -->
      <section class="panel editor-panel" v-if="isNew || selected">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="lbl">模板名称</label>
            <input v-model="draft.name" class="form-input" placeholder="如 邮箱验证码" />
          </div>
          <div>
            <label class="lbl">模板标识 (slug)</label>
            <input v-model="draft.slug" class="form-input" :disabled="!isNew" placeholder="verification_code" />
          </div>
        </div>

        <div>
          <label class="lbl">邮件主题</label>
          <input v-model="draft.subject" class="form-input" placeholder="【CSMS】您的邮箱验证码" />
        </div>

        <div>
          <label class="lbl">HTML 正文（支持 <code class="code">{{ demoVar }}</code>）</label>
          <textarea v-model="draft.bodyHtml" class="form-input mono" rows="12" placeholder="<div>验证码：{{code}}</div>"></textarea>
        </div>

        <div>
          <label class="lbl">变量（逗号分隔，用于代码侧传参与预览示例）</label>
          <input v-model="draft.variablesRaw" class="form-input" placeholder="code, email, expiresMinutes" />
          <div v-if="variableKeys.length" class="var-chips">
            <span v-for="k in variableKeys" :key="k" class="chip">{{ k }}</span>
          </div>
        </div>

        <div class="flex items-center gap-3 pt-2">
          <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? '保存中...' : '保存' }}</button>
          <button v-if="!isNew" class="btn btn-danger btn-sm" @click="remove">删除模板</button>
        </div>

        <!-- 验证码模板测试面板 -->
        <div v-if="isVerificationTemplate" class="test-card">
          <div class="panel-title mb-2">验证码模板测试</div>
          <p class="text-xs text-slate-400 mb-3 leading-relaxed">
            向测试邮箱发送真实验证码并验证，确认模板渲染与发信链路正常。测试使用<b>当前编辑中的主题与正文</b>（无需先保存）。
          </p>
          <div class="flex items-end gap-2 flex-wrap">
            <div class="flex-1 min-w-[200px]">
              <label class="lbl">测试收件邮箱</label>
              <input v-model="testEmail" class="form-input" placeholder="test@example.com" :disabled="testSending" />
            </div>
            <button class="btn btn-ghost" :disabled="testSending" @click="sendTestCode">
              {{ testSending ? '发送中...' : '发送验证码' }}
            </button>
          </div>
          <div v-if="devCode" class="dev-code">开发模式验证码：<b>{{ devCode }}</b>（未配置邮件服务时显示）</div>
          <div class="flex items-end gap-2 flex-wrap mt-3">
            <div class="flex-1 min-w-[160px]">
              <label class="lbl">收到的验证码</label>
              <input v-model="testCode" class="form-input" placeholder="6 位验证码" :disabled="testVerifying" />
            </div>
            <button class="btn btn-ghost" :disabled="testVerifying" @click="verifyTestCode">
              {{ testVerifying ? '验证中...' : '验证' }}
            </button>
          </div>
          <div v-if="testMsg" class="test-result" :class="testOk ? 'ok' : 'fail'">{{ testMsg }}</div>
        </div>
      </section>
      <section v-else class="panel editor-panel text-slate-400 text-sm">请选择左侧模板，或点击「新建」。</section>

      <!-- 实时预览 -->
      <aside class="panel preview-panel">
        <div class="panel-title mb-3">实时预览</div>
        <div class="preview-subject">主题：{{ previewSubject || '（空）' }}</div>
        <div class="preview-frame" v-html="previewHtml || '<p style=\'color:#64748b\'>（正文为空）</p>'"></div>
        <div v-if="variableKeys.length" class="preview-note">
          当前示例变量：{{ variableKeys.map(k => `${k}=${sampleVars[k]}`).join('，') }}
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.page-title { font-size: 22px; font-weight: 700; color: #e2e8f0; margin: 0; }
.page-sub { font-size: 13px; color: #94a3b8; margin: 6px 0 0; line-height: 1.6; }
.code { background: rgba(74,122,181,0.15); color: #8fb3dc; padding: 1px 6px; border-radius: 6px; font-size: 12px; }

.layout { display: grid; grid-template-columns: 220px 1fr 380px; gap: 16px; align-items: start; }
@media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } }

.panel { background: rgba(15,23,42,0.85); border: 1px solid rgba(74,122,181,0.22); border-radius: 16px; padding: 16px; }
.panel-title { font-size: 13px; font-weight: 600; color: #cbd5e1; text-transform: uppercase; letter-spacing: .04em; }
.list-panel .list-item { padding: 10px 12px; border-radius: 10px; cursor: pointer; border: 1px solid transparent; transition: .15s; }
.list-panel .list-item:hover { background: rgba(74,122,181,0.1); }
.list-panel .list-item.active { background: rgba(74,122,181,0.18); border-color: rgba(74,122,181,0.4); }
.li-name { font-size: 14px; color: #e2e8f0; }
.li-slug { font-size: 11px; color: #64748b; font-family: ui-monospace, monospace; }

.lbl { display: block; font-size: 12px; color: #94a3b8; margin: 14px 0 6px; }
.form-input { width: 100%; background: #0b1220; border: 1px solid rgba(148,163,184,0.22); color: #e2e8f0; border-radius: 10px; padding: 9px 12px; font-size: 14px; outline: none; }
.form-input:focus { border-color: #4a7ab5; box-shadow: 0 0 0 3px rgba(74,122,181,0.2); }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; line-height: 1.5; }
.var-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.chip { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: rgba(74,122,181,0.15); color: #8fb3dc; font-family: ui-monospace, monospace; }

.preview-subject { font-size: 13px; color: #cbd5e1; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid rgba(148,163,184,0.15); }
.preview-frame { background: #fff; border-radius: 12px; padding: 16px; min-height: 220px; color: #0f172a; overflow: auto; }
.preview-note { margin-top: 10px; font-size: 11px; color: #64748b; line-height: 1.5; word-break: break-all; }

.test-card { margin-top: 18px; padding: 16px; border: 1px dashed rgba(74,122,181,0.45); border-radius: 14px; background: rgba(74,122,181,0.06); }
.dev-code { margin-top: 10px; font-size: 12px; color: #fbbf24; font-family: ui-monospace, monospace; }
.test-result { margin-top: 10px; font-size: 13px; padding: 8px 12px; border-radius: 8px; line-height: 1.5; }
.test-result.ok { background: rgba(16,185,129,0.15); color: #6ee7b7; }
.test-result.fail { background: rgba(239,68,68,0.15); color: #fca5a5; }
</style>
