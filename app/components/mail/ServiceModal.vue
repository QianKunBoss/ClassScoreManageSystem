<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import type { MailService } from '~/types'
import { useToast } from '~/composables/useToast'

const props = defineProps<{ open: boolean; service: MailService | null }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'saved'): void }>()

const toast = useToast()

const providerPresets: Record<string, { host: string; port: number; secure: string }> = {
  qq: { host: 'smtp.qq.com', port: 465, secure: 'ssl' },
  '163': { host: 'smtp.163.com', port: 465, secure: 'ssl' },
  gmail: { host: 'smtp.gmail.com', port: 587, secure: 'tls' },
  outlook: { host: 'smtp.office365.com', port: 587, secure: 'tls' },
  aliyun: { host: 'smtp.aliyun.com', port: 465, secure: 'ssl' },
  custom: { host: '', port: 587, secure: 'tls' },
}
const providerLabels: Record<string, string> = {
  qq: 'QQ 邮箱', '163': '163 邮箱', gmail: 'Gmail', outlook: 'Outlook', aliyun: '阿里云邮箱', custom: '自定义',
}

const form = reactive({
  name: '', provider: 'custom', host: '', port: 587, secure: 'tls',
  username: '', password: '', fromName: '', fromAddress: '', priority: 0, enabled: 1,
})
const saving = ref(false)
const testingConn = ref(false)
const sendingTest = ref(false)
const testTo = ref('')
const showPassword = ref(false)

const isEdit = computed(() => !!props.service)
const title = computed(() => (isEdit.value ? '编辑邮件服务' : '添加邮件服务'))

watch(() => props.open, (v) => {
  if (!v) return
  if (props.service) {
    Object.assign(form, {
      name: props.service.name, provider: props.service.provider, host: props.service.host,
      port: props.service.port, secure: props.service.secure, username: props.service.username,
      password: '', fromName: props.service.fromName, fromAddress: props.service.fromAddress,
      priority: props.service.priority, enabled: props.service.enabled,
    })
  } else {
    Object.assign(form, {
      name: '', provider: 'custom', host: '', port: 587, secure: 'tls',
      username: '', password: '', fromName: '', fromAddress: '', priority: 0, enabled: 1,
    })
  }
  testTo.value = ''
})

function onProviderChange() {
  const p = providerPresets[form.provider]
  if (p) {
    form.host = p.host
    form.port = p.port
    form.secure = p.secure
  }
}

async function save() {
  if (!form.name.trim()) { toast.error('请填写服务名称'); return }
  if (!form.host.trim()) { toast.error('请填写 SMTP 服务器地址'); return }
  saving.value = true
  try {
    const payload = { ...form, name: form.name.trim(), host: form.host.trim() }
    if (isEdit.value) {
      await $fetch(`/api/mail-services/${props.service!.id}`, { method: 'PATCH', body: payload })
    } else {
      await $fetch('/api/mail-services', { method: 'POST', body: payload })
    }
    toast.success(isEdit.value ? '已保存' : '邮件服务已添加')
    emit('saved')
    emit('close')
  } catch (err: any) {
    toast.error(err?.data?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function testConnection() {
  testingConn.value = true
  try {
    const res = await $fetch('/api/mail-services/test-connection', { method: 'POST', body: form })
    toast.success(res.message || '连接成功')
  } catch (err: any) {
    toast.error(err?.data?.message || '连接失败')
  } finally {
    testingConn.value = false
  }
}

async function testSend() {
  if (!form.fromAddress.trim()) { toast.error('请填写发件人邮箱后再发送测试'); return }
  sendingTest.value = true
  try {
    const res = await $fetch('/api/mail-services/test-send', {
      method: 'POST',
      body: { ...form, to: testTo.value.trim() },
    })
    toast.success(res.message || '测试邮件已发送')
  } catch (err: any) {
    toast.error(err?.data?.message || '发送失败')
  } finally {
    sendingTest.value = false
  }
}
</script>

<template>
  <div v-if="open" class="modal-overlay" @click.self="emit('close')">
    <div class="modal-box">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-semibold text-slate-100">{{ title }}</h3>
        <button class="icon-btn" @click="emit('close')" aria-label="关闭"><MorphIcon name="x" :size="16" class="pointer-events-none" /></button>
      </div>

      <div class="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="lbl">服务名称</label>
            <input v-model="form.name" class="form-input" placeholder="如 主邮件服务" />
          </div>
          <div>
            <label class="lbl">服务提供商</label>
            <select v-model="form.provider" class="form-input" @change="onProviderChange">
              <option v-for="(l, k) in providerLabels" :key="k" :value="k">{{ l }}</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-4">
          <div class="col-span-2">
            <label class="lbl">SMTP 服务器</label>
            <input v-model="form.host" class="form-input" placeholder="smtp.example.com" />
          </div>
          <div>
            <label class="lbl">端口</label>
            <input v-model.number="form.port" type="number" class="form-input" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="lbl">安全连接</label>
            <select v-model="form.secure" class="form-input">
              <option value="none">None（明文）</option>
              <option value="ssl">SSL（隐式 TLS，通常 465）</option>
              <option value="tls">TLS（STARTTLS，通常 587）</option>
            </select>
          </div>
          <div>
            <label class="lbl">优先级（0 最高）</label>
            <input v-model.number="form.priority" type="number" class="form-input" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="lbl">用户名</label>
            <input v-model="form.username" class="form-input" placeholder="完整邮箱或认证账号" />
          </div>
          <div>
            <label class="lbl">密码 / 授权码</label>
            <div class="relative">
              <input
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                class="form-input pr-10"
                :placeholder="isEdit ? '留空则保留原密码' : 'SMTP 密码 / 授权码'"
              />
              <button type="button" class="abs-eye" @click="showPassword = !showPassword">
                {{ showPassword ? '隐藏' : '显示' }}
              </button>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="lbl">发件人名称</label>
            <input v-model="form.fromName" class="form-input" placeholder="如 CSMS 系统" />
          </div>
          <div>
            <label class="lbl">发件人邮箱</label>
            <input v-model="form.fromAddress" type="email" class="form-input" placeholder="no-reply@example.com" />
          </div>
        </div>

        <label class="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" v-model="form.enabled" :true-value="1" :false-value="0" />
          启用此邮件服务（参与优先级故障转移发送）
        </label>

        <div class="rounded-lg bg-slate-800/50 border border-slate-700/60 p-4 space-y-3">
          <div class="text-xs text-slate-400 uppercase tracking-wide">本服务连接测试</div>
          <div class="flex items-center gap-3 flex-wrap">
            <button type="button" class="btn btn-ghost" :disabled="testingConn" @click="testConnection">
              {{ testingConn ? '测试中...' : '连接测试' }}
            </button>
            <input v-model="testTo" class="form-input flex-1 min-w-[180px]" placeholder="测试收件邮箱（留空则用发件人邮箱）" />
            <button type="button" class="btn btn-ghost" :disabled="sendingTest" @click="testSend">
              {{ sendingTest ? '发送中...' : '发送测试邮件' }}
            </button>
          </div>
          <p class="text-xs text-slate-500">测试使用当前表单填写的配置，无需先保存。</p>
        </div>
      </div>

      <div class="flex items-center justify-end gap-3 pt-4 mt-2 border-t border-slate-700/50">
        <button type="button" class="btn btn-ghost" @click="emit('close')">取消</button>
        <button type="button" class="btn btn-primary" :disabled="saving" @click="save">
          {{ saving ? '保存中...' : '保存' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; background: rgba(2, 6, 15, 0.72);
  backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center;
  z-index: 50; padding: 16px;
}
.modal-box {
  width: 100%; max-width: 640px; background: #0f172a; border: 1px solid rgba(74, 122, 181, 0.25);
  border-radius: 16px; padding: 22px; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
}
.lbl { display: block; font-size: 12px; color: #94a3b8; margin-bottom: 6px; }
.icon-btn { background: transparent; border: none; color: #94a3b8; font-size: 16px; cursor: pointer; padding: 4px 8px; border-radius: 8px; }
.icon-btn:hover { background: rgba(148, 163, 184, 0.12); color: #e2e8f0; }
.abs-eye { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: transparent; border: none; color: #4a7ab5; font-size: 12px; cursor: pointer; }
.relative { position: relative; }
</style>
