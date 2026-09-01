<script setup lang="ts">
import type { ApiTokenItem, ApiScopeMeta, ApiAuditLogItem, ApiScopeType } from '~/types'

definePageMeta({ auth: true })

const toast = useToast()

const { data: authData } = useFetch('/api/auth/me', {
  credentials: 'include',
  server: false,
  default: () => ({ success: false, admin: null }),
})
const currentUser = computed(() => (authData.value as any)?.admin || null)
const isSuper = computed(() => currentUser.value?.role === 'super_admin')

// ===== 学校上下文 =====
// 超级管理员不隶属任何学校，后端要求显式 ?schoolId=，故需先选校
const schools = ref<any[]>([])
const filterSchoolId = ref<number | null>(null)

const baseQuery = computed<Record<string, any>>(() =>
  isSuper.value && filterSchoolId.value ? { schoolId: filterSchoolId.value } : {},
)
const contextReady = computed(() => !!currentUser.value && (!isSuper.value || !!filterSchoolId.value))

// ===== 视图状态 =====
const tab = ref<'tokens' | 'logs'>('tokens')

const tokens = ref<ApiTokenItem[]>([])
const loadingTokens = ref(true)

const meta = ref<{
  scopes: ApiScopeMeta[]
  scopeTypes: ApiScopeType[]
  fixedGradeId: number | null
  fixedClassId: number | null
  role: string
  maxExpireDays: number
} | null>(null)

const grades = ref<any[]>([])
const classes = ref<any[]>([])

const baseUrl = ref('')
onMounted(() => {
  baseUrl.value = `${window.location.origin}/api/v1`
})

// ===== 数据加载 =====
async function loadSchools() {
  if (!isSuper.value || schools.value.length) return
  try {
    const res = await $fetch<{ data: any[] }>('/api/schools')
    schools.value = res.data || []
  } catch {
    toast.error('加载学校列表失败')
  }
}

async function loadMeta() {
  if (meta.value) return
  try {
    const res = await $fetch<{ data: any }>('/api/api-tokens/meta')
    meta.value = res.data
  } catch (e: any) {
    toast.error(e?.data?.message || '加载权限清单失败')
  }
}

async function loadStructure() {
  try {
    const [g, c] = await Promise.all([
      $fetch<{ data: any[] }>('/api/grades', { query: baseQuery.value }),
      $fetch<{ data: any[] }>('/api/classes', { query: baseQuery.value }),
    ])
    grades.value = g.data || []
    classes.value = c.data || []
  } catch {
    // 组织结构只影响范围选择器的可读性，失败不阻断主流程
    grades.value = []
    classes.value = []
  }
}

async function loadTokens() {
  if (!contextReady.value) {
    tokens.value = []
    loadingTokens.value = false
    return
  }
  loadingTokens.value = true
  try {
    const res = await $fetch<{ data: ApiTokenItem[] }>('/api/api-tokens', { query: baseQuery.value })
    tokens.value = res.data || []
  } catch (e: any) {
    toast.error(e?.data?.message || '加载凭证列表失败')
    tokens.value = []
  } finally {
    loadingTokens.value = false
  }
}

// ===== 审计日志 =====
const logs = ref<ApiAuditLogItem[]>([])
const loadingLogs = ref(false)
const logFilter = ref({ tokenId: '' as string | number, method: '', onlyFailed: false })
const logPage = ref(1)
const logTotal = ref(0)
const logTotalPages = ref(0)
const LOG_LIMIT = 20

async function loadLogs() {
  if (!contextReady.value) {
    logs.value = []
    return
  }
  loadingLogs.value = true
  try {
    const query: Record<string, any> = { ...baseQuery.value, page: logPage.value, limit: LOG_LIMIT }
    if (logFilter.value.tokenId !== '') query.tokenId = logFilter.value.tokenId
    if (logFilter.value.method) query.method = logFilter.value.method
    if (logFilter.value.onlyFailed) query.onlyFailed = 'true'

    const res = await $fetch<{ data: ApiAuditLogItem[]; total: number; totalPages: number }>(
      '/api/api-tokens/logs',
      { query },
    )
    logs.value = res.data || []
    logTotal.value = res.total || 0
    logTotalPages.value = res.totalPages || 0
  } catch (e: any) {
    toast.error(e?.data?.message || '加载调用日志失败')
    logs.value = []
  } finally {
    loadingLogs.value = false
  }
}

watch([() => currentUser.value?.id, filterSchoolId], async () => {
  if (!currentUser.value) return
  await loadSchools()
  await loadMeta()
  if (!contextReady.value) {
    tokens.value = []
    loadingTokens.value = false
    return
  }
  await Promise.all([loadStructure(), loadTokens()])
  if (tab.value === 'logs') await loadLogs()
}, { immediate: true })

watch(tab, (t) => {
  if (t === 'logs' && !logs.value.length) loadLogs()
})
watch([() => logFilter.value.tokenId, () => logFilter.value.method, () => logFilter.value.onlyFailed], () => {
  logPage.value = 1
  loadLogs()
})

// ===== 工具 =====
function fmt(iso: string | null) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function scopeLabelOf(key: string) {
  return meta.value?.scopes.find((s) => s.key === key)?.label || key
}
function isDangerous(key: string) {
  return !!meta.value?.scopes.find((s) => s.key === key)?.dangerous
}

/** 权限项按业务域分组渲染，避免 12 个 checkbox 平铺后无从下手 */
const scopeGroups = computed(() => {
  const map = new Map<string, ApiScopeMeta[]>()
  for (const s of meta.value?.scopes || []) {
    if (!map.has(s.group)) map.set(s.group, [])
    map.get(s.group)!.push(s)
  }
  return [...map.entries()].map(([group, items]) => ({ group, items }))
})

const scopeTypeLabel: Record<string, string> = {
  school: '全校',
  grade: '指定年级',
  class: '指定班级',
}

function statusClass(code: number) {
  if (code >= 500) return 'text-red-400'
  if (code >= 400) return 'text-amber-400'
  return 'text-emerald-400'
}

async function copyText(text: string, okMsg = '已复制到剪贴板') {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(okMsg)
  } catch {
    // 非 HTTPS 或旧浏览器下 clipboard API 不可用，退回手动选中
    toast.error('复制失败，请手动选中文本复制')
  }
}

// ===== 签发 =====
const showCreate = ref(false)
const creating = ref(false)
const createForm = ref({
  name: '',
  scopeType: 'school' as ApiScopeType,
  scopeGradeId: null as number | null,
  scopeClassId: null as number | null,
  scopes: [] as string[],
  neverExpire: false,
  expiresInDays: 90,
  confirmPassword: '',
})

/** 签发成功后的一次性明文展示 */
const issuedToken = ref<string | null>(null)
const issuedName = ref('')

const availableClasses = computed(() => {
  if (createForm.value.scopeType !== 'class') return classes.value
  // 年级管理员只能签本年级下的班级凭证，前端先收窄，后端仍会再校验
  const gid = meta.value?.fixedGradeId
  return gid ? classes.value.filter((c: any) => Number(c.gradeId) === Number(gid)) : classes.value
})

function openCreate() {
  const m = meta.value
  createForm.value = {
    name: '',
    scopeType: (m?.scopeTypes?.[0] as ApiScopeType) || 'school',
    scopeGradeId: m?.fixedGradeId ?? null,
    scopeClassId: m?.fixedClassId ?? null,
    scopes: ['students:read', 'scores:read', 'scores:write', 'templates:read'],
    neverExpire: false,
    expiresInDays: 90,
    confirmPassword: '',
  }
  showCreate.value = true
}

function applyPreset(kind: 'readonly' | 'scoring' | 'all') {
  const all = meta.value?.scopes.map((s) => s.key) || []
  if (kind === 'readonly') {
    createForm.value.scopes = all.filter((k) => k.endsWith(':read'))
  } else if (kind === 'scoring') {
    createForm.value.scopes = ['students:read', 'scores:read', 'scores:write', 'templates:read']
  } else {
    createForm.value.scopes = [...all]
  }
}

const hasDangerousSelected = computed(() => createForm.value.scopes.some((k) => isDangerous(k)))

async function submitCreate() {
  const f = createForm.value
  if (!f.name.trim()) { toast.error('请填写凭证名称'); return }
  if (!f.scopes.length) { toast.error('请至少勾选一项权限'); return }
  if (f.scopeType === 'grade' && !f.scopeGradeId) { toast.error('请选择年级'); return }
  if (f.scopeType === 'class' && !f.scopeClassId) { toast.error('请选择班级'); return }
  if (!f.confirmPassword) { toast.error('请输入登录密码以确认签发'); return }

  creating.value = true
  try {
    const res = await $fetch<{ token: string; data: any }>('/api/api-tokens', {
      method: 'POST',
      query: baseQuery.value,
      body: {
        name: f.name.trim(),
        scopeType: f.scopeType,
        scopeGradeId: f.scopeType === 'grade' ? f.scopeGradeId : null,
        scopeClassId: f.scopeType === 'class' ? f.scopeClassId : null,
        scopes: f.scopes,
        expiresInDays: f.neverExpire ? null : f.expiresInDays,
        confirmPassword: f.confirmPassword,
      },
    })
    showCreate.value = false
    issuedName.value = f.name.trim()
    issuedToken.value = res.token
    await loadTokens()
  } catch (e: any) {
    toast.error(e?.data?.message || e?.data?.statusMessage || '签发失败')
  } finally {
    creating.value = false
    createForm.value.confirmPassword = ''
  }
}

// ===== 编辑 =====
const showEdit = ref(false)
const editing = ref<ApiTokenItem | null>(null)
const editForm = ref({
  name: '',
  scopes: [] as string[],
  expiryMode: 'keep' as 'keep' | 'never' | 'days',
  expiresInDays: 90,
})

function openEdit(t: ApiTokenItem) {
  editing.value = t
  editForm.value = { name: t.name, scopes: [...t.scopes], expiryMode: 'keep', expiresInDays: 90 }
  showEdit.value = true
}

async function submitEdit() {
  if (!editing.value) return
  const f = editForm.value
  if (!f.name.trim()) { toast.error('凭证名称不能为空'); return }
  if (!f.scopes.length) { toast.error('请至少保留一项权限'); return }

  const body: Record<string, any> = { name: f.name.trim(), scopes: f.scopes }
  if (f.expiryMode === 'never') body.expiresInDays = null
  else if (f.expiryMode === 'days') body.expiresInDays = f.expiresInDays

  try {
    await $fetch(`/api/api-tokens/${editing.value.id}`, {
      method: 'PATCH',
      query: baseQuery.value,
      body,
    })
    showEdit.value = false
    toast.success('凭证已更新')
    await loadTokens()
  } catch (e: any) {
    toast.error(e?.data?.message || '更新失败')
  }
}

async function toggleDisabled(t: ApiTokenItem) {
  try {
    const res = await $fetch<{ message: string }>(`/api/api-tokens/${t.id}`, {
      method: 'PATCH',
      query: baseQuery.value,
      body: { disabled: !t.disabled },
    })
    toast.success(res.message || '操作成功')
    await loadTokens()
  } catch (e: any) {
    toast.error(e?.data?.message || '操作失败')
  }
}

// ===== 吊销 =====
const showRevoke = ref(false)
const revoking = ref<ApiTokenItem | null>(null)
const revokePassword = ref('')
const revokeBusy = ref(false)

function openRevoke(t: ApiTokenItem) {
  revoking.value = t
  revokePassword.value = ''
  showRevoke.value = true
}

async function submitRevoke() {
  if (!revoking.value) return
  if (!revokePassword.value) { toast.error('请输入登录密码'); return }
  revokeBusy.value = true
  try {
    const res = await $fetch<{ message: string }>(`/api/api-tokens/${revoking.value.id}`, {
      method: 'DELETE',
      query: baseQuery.value,
      headers: { 'x-confirm-password': revokePassword.value },
    })
    showRevoke.value = false
    toast.success(res.message || '凭证已吊销')
    await loadTokens()
  } catch (e: any) {
    toast.error(e?.data?.message || '吊销失败')
  } finally {
    revokeBusy.value = false
    revokePassword.value = ''
  }
}

// ===== 接入速览 =====
const showGuide = ref(false)
const curlSample = computed(
  () => `curl -X POST "${baseUrl.value || 'https://<你的域名>/api/v1'}/scores" \\
  -H "Authorization: Bearer csms_xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{"username":"20240101","scoreChange":2,"description":"课堂表现优秀"}'`,
)
</script>

<template>
  <div>
    <!-- 页头 -->
    <section class="border-b border-slate-800/50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-xl font-bold text-slate-100 mb-1">外部 API 凭证</h1>
          <p class="text-sm text-slate-500">签发给第三方系统的调用凭证，权限与范围均不超过签发者自身管辖</p>
        </div>
        <div class="flex items-center gap-3">
          <select
            v-if="isSuper"
            v-model="filterSchoolId"
            class="form-input text-sm py-1.5 w-48"
          >
            <option :value="null">请选择学校</option>
            <option v-for="s in schools" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
          <button class="btn btn-ghost" @click="showGuide = !showGuide">接入速览</button>
          <button class="btn btn-primary" :disabled="!contextReady" @click="openCreate">+ 签发凭证</button>
        </div>
      </div>
    </section>

    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <!-- 接入速览 -->
      <div v-if="showGuide" class="glass-card p-6 space-y-4">
        <div class="flex items-start justify-between">
          <h2 class="text-sm font-bold text-slate-100">快速接入</h2>
          <button class="text-xs text-slate-500 hover:text-slate-300" @click="showGuide = false">收起</button>
        </div>
        <div class="space-y-2 text-xs text-slate-400">
          <p>接口基址：<code class="px-1.5 py-0.5 rounded bg-slate-800/60 text-brand-300">{{ baseUrl || '/api/v1' }}</code></p>
          <p>鉴权方式：请求头 <code class="px-1.5 py-0.5 rounded bg-slate-800/60 text-brand-300">Authorization: Bearer &lt;token&gt;</code>（也支持 <code class="px-1.5 py-0.5 rounded bg-slate-800/60 text-brand-300">X-API-Token</code>）</p>
          <p>写操作建议带 <code class="px-1.5 py-0.5 rounded bg-slate-800/60 text-brand-300">Idempotency-Key</code> 头，重试不会重复扣分。</p>
          <p>限流：单凭证 600 次/分钟，其中写操作 120 次/分钟。完整字段说明见仓库 <code class="px-1.5 py-0.5 rounded bg-slate-800/60 text-brand-300">docs/API.md</code>。</p>
        </div>
        <div class="relative">
          <pre class="p-4 rounded-lg bg-[#070b14] border border-slate-800/60 text-[11px] leading-relaxed text-slate-300 overflow-x-auto">{{ curlSample }}</pre>
          <button
            class="absolute top-2 right-2 text-[11px] px-2 py-1 rounded bg-slate-800/80 text-slate-300 hover:text-brand-300"
            @click="copyText(curlSample, '示例已复制')"
          >复制</button>
        </div>
      </div>

      <!-- Tab -->
      <div class="flex items-center gap-1 border-b border-slate-800/50">
        <button
          v-for="t in [{ k: 'tokens', label: '凭证列表' }, { k: 'logs', label: '调用日志' }]"
          :key="t.k"
          class="px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px"
          :class="tab === t.k
            ? 'text-brand-300 border-brand-500'
            : 'text-slate-500 border-transparent hover:text-slate-300'"
          @click="tab = t.k as any"
        >{{ t.label }}</button>
      </div>

      <!-- 未选校提示 -->
      <div v-if="!contextReady" class="glass-card p-12 text-center text-sm text-slate-500">
        请先在右上角选择要管理的学校
      </div>

      <!-- 凭证列表 -->
      <template v-else-if="tab === 'tokens'">
        <div v-if="loadingTokens" class="space-y-3">
          <div v-for="i in 3" :key="i" class="h-28 rounded-xl bg-slate-800/40 animate-pulse"></div>
        </div>

        <div v-else-if="tokens.length" class="space-y-4">
          <div
            v-for="t in tokens"
            :key="t.id"
            class="glass-card p-5"
            :class="t.disabled || t.expired ? 'opacity-70' : ''"
          >
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2 mb-2">
                  <h3 class="text-sm font-bold text-slate-100 truncate">{{ t.name }}</h3>
                  <span v-if="t.disabled" class="badge badge-danger">已禁用</span>
                  <span v-else-if="t.expired" class="badge badge-warning">已过期</span>
                  <span v-else class="badge badge-success">生效中</span>
                  <span class="badge badge-primary">{{ t.scopeLabel }}</span>
                </div>

                <div class="flex flex-wrap items-center gap-2 mb-3">
                  <code class="text-xs px-2 py-1 rounded bg-slate-800/60 text-slate-300 font-mono">{{ t.tokenPrefix }}…</code>
                  <button class="text-[11px] text-slate-500 hover:text-brand-300" @click="copyText(t.tokenPrefix, '前缀已复制')">
                    复制前缀
                  </button>
                  <span class="text-[11px] text-slate-600">明文仅在签发时显示一次，丢失请吊销重发</span>
                </div>

                <div class="flex flex-wrap gap-1.5 mb-3">
                  <span
                    v-for="s in t.scopes"
                    :key="s"
                    class="text-[11px] px-2 py-0.5 rounded border"
                    :class="isDangerous(s)
                      ? 'border-red-500/40 bg-red-500/10 text-red-300'
                      : 'border-slate-700/60 bg-slate-800/40 text-slate-400'"
                  >{{ scopeLabelOf(s) }}</span>
                </div>

                <dl class="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 text-[11px]">
                  <div><dt class="text-slate-600 inline">调用次数：</dt><dd class="text-slate-300 inline">{{ t.callCount }}</dd></div>
                  <div><dt class="text-slate-600 inline">最近调用：</dt><dd class="text-slate-300 inline">{{ fmt(t.lastUsedAt) }}</dd></div>
                  <div><dt class="text-slate-600 inline">来源 IP：</dt><dd class="text-slate-300 inline">{{ t.lastUsedIp || '-' }}</dd></div>
                  <div><dt class="text-slate-600 inline">有效期至：</dt><dd class="text-slate-300 inline">{{ t.expiresAt ? fmt(t.expiresAt) : '永不过期' }}</dd></div>
                  <div><dt class="text-slate-600 inline">签发人：</dt><dd class="text-slate-300 inline">{{ t.createdByAdmin || '-' }}</dd></div>
                  <div><dt class="text-slate-600 inline">签发时间：</dt><dd class="text-slate-300 inline">{{ fmt(t.createdAt) }}</dd></div>
                </dl>
              </div>

              <div class="flex shrink-0 flex-col gap-2">
                <button class="btn btn-ghost text-xs py-1.5" @click="openEdit(t)">编辑</button>
                <button class="btn btn-ghost text-xs py-1.5" @click="toggleDisabled(t)">
                  {{ t.disabled ? '启用' : '禁用' }}
                </button>
                <button class="btn btn-danger text-xs py-1.5" @click="openRevoke(t)">吊销</button>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="glass-card p-12 text-center">
          <p class="text-sm text-slate-500 mb-2">尚未签发任何外部 API 凭证</p>
          <p class="text-xs text-slate-600">第三方系统需要凭证才能调用 /api/v1 接口</p>
        </div>
      </template>

      <!-- 调用日志 -->
      <template v-else>
        <div class="glass-card p-5">
          <div class="flex flex-wrap items-center gap-3 mb-4">
            <select v-model="logFilter.tokenId" class="form-input text-xs py-1.5 w-44">
              <option value="">全部凭证</option>
              <option v-for="t in tokens" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
            <select v-model="logFilter.method" class="form-input text-xs py-1.5 w-32">
              <option value="">全部方法</option>
              <option v-for="m in ['GET', 'POST', 'PATCH', 'DELETE']" :key="m" :value="m">{{ m }}</option>
            </select>
            <label class="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input v-model="logFilter.onlyFailed" type="checkbox" class="accent-brand-500" />
              仅看失败（状态码 ≥ 400）
            </label>
            <button class="btn btn-ghost text-xs py-1.5 ml-auto" @click="loadLogs">刷新</button>
          </div>

          <div v-if="loadingLogs" class="space-y-2">
            <div v-for="i in 6" :key="i" class="h-9 rounded bg-slate-800/40 animate-pulse"></div>
          </div>

          <div v-else-if="logs.length" class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead>
                <tr class="text-slate-500 border-b border-slate-800/60">
                  <th class="text-left font-medium py-2 pr-3 whitespace-nowrap">时间</th>
                  <th class="text-left font-medium py-2 pr-3">方法</th>
                  <th class="text-left font-medium py-2 pr-3">路径</th>
                  <th class="text-left font-medium py-2 pr-3">状态</th>
                  <th class="text-left font-medium py-2 pr-3">耗时</th>
                  <th class="text-left font-medium py-2 pr-3">凭证</th>
                  <th class="text-left font-medium py-2 pr-3">IP</th>
                  <th class="text-left font-medium py-2">错误</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="l in logs" :key="l.id" class="border-b border-slate-800/30 hover:bg-slate-800/20">
                  <td class="py-2 pr-3 text-slate-400 whitespace-nowrap">{{ fmt(l.createdAt) }}</td>
                  <td class="py-2 pr-3 text-slate-300 font-mono">{{ l.method }}</td>
                  <td class="py-2 pr-3 text-slate-400 max-w-[220px] truncate" :title="l.path">{{ l.path }}</td>
                  <td class="py-2 pr-3 font-mono font-bold" :class="statusClass(l.statusCode)">{{ l.statusCode }}</td>
                  <td class="py-2 pr-3 text-slate-500">{{ l.latencyMs }}ms</td>
                  <td class="py-2 pr-3 text-slate-500 font-mono">{{ l.tokenPrefix || '-' }}</td>
                  <td class="py-2 pr-3 text-slate-500 font-mono">{{ l.ip || '-' }}</td>
                  <td class="py-2 text-red-400/80 max-w-[200px] truncate" :title="l.errorMessage">{{ l.errorMessage || '-' }}</td>
                </tr>
              </tbody>
            </table>

            <div class="flex items-center justify-between mt-4 text-xs text-slate-500">
              <span>共 {{ logTotal }} 条</span>
              <div class="flex items-center gap-2">
                <button
                  class="btn btn-ghost text-xs py-1"
                  :disabled="logPage <= 1"
                  @click="logPage--; loadLogs()"
                >上一页</button>
                <span>{{ logPage }} / {{ logTotalPages || 1 }}</span>
                <button
                  class="btn btn-ghost text-xs py-1"
                  :disabled="logPage >= logTotalPages"
                  @click="logPage++; loadLogs()"
                >下一页</button>
              </div>
            </div>
          </div>

          <div v-else class="py-12 text-center text-sm text-slate-500">暂无调用记录</div>
        </div>
      </template>
    </section>

    <!-- 签发模态框 -->
    <ClientOnly>
      <Teleport to="body">
        <div v-if="showCreate" class="modal-backdrop" @click.self="showCreate = false">
          <div class="modal-content max-w-2xl">
            <div class="modal-header">
              <h3 class="text-base font-bold text-slate-100">签发外部 API 凭证</h3>
              <button class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500" @click="showCreate = false">
                <MorphIcon name="x" :size="16" class="pointer-events-none" />
              </button>
            </div>
            <div class="modal-body space-y-5">
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase">凭证名称</label>
                <input v-model="createForm.name" type="text" placeholder="如：钉钉家校通对接" class="form-input" />
                <p class="mt-1 text-[11px] text-slate-600">建议写明用途与对接方，便于日后排查调用来源</p>
              </div>

              <!-- 范围 -->
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase">数据范围</label>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="st in meta?.scopeTypes || []"
                    :key="st"
                    class="px-3 py-1.5 rounded-lg border text-xs transition-colors"
                    :class="createForm.scopeType === st
                      ? 'border-brand-500 bg-brand-500/10 text-brand-300'
                      : 'border-slate-700/60 text-slate-400 hover:border-slate-600'"
                    @click="createForm.scopeType = st"
                  >{{ scopeTypeLabel[st] }}</button>
                </div>

                <div v-if="createForm.scopeType === 'grade'" class="mt-3">
                  <select v-model="createForm.scopeGradeId" class="form-input text-sm" :disabled="!!meta?.fixedGradeId">
                    <option :value="null">请选择年级</option>
                    <option v-for="g in grades" :key="g.id" :value="g.id">{{ g.name }}</option>
                  </select>
                </div>
                <div v-if="createForm.scopeType === 'class'" class="mt-3">
                  <select v-model="createForm.scopeClassId" class="form-input text-sm" :disabled="!!meta?.fixedClassId">
                    <option :value="null">请选择班级</option>
                    <option v-for="c in availableClasses" :key="c.id" :value="c.id">
                      {{ c.gradeName ? `${c.gradeName} ` : '' }}{{ c.name }}
                    </option>
                  </select>
                </div>
                <p class="mt-2 text-[11px] text-slate-600">
                  凭证只能读写该范围内的数据，范围外的请求会被直接拒绝，且不得超过你自身的管辖范围
                </p>
              </div>

              <!-- 权限 -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <label class="block text-xs font-medium text-slate-400 uppercase">权限项</label>
                  <div class="flex items-center gap-2 text-[11px]">
                    <button class="text-brand-400 hover:text-brand-300" @click="applyPreset('scoring')">加分对接</button>
                    <span class="text-slate-700">|</span>
                    <button class="text-brand-400 hover:text-brand-300" @click="applyPreset('readonly')">只读</button>
                    <span class="text-slate-700">|</span>
                    <button class="text-brand-400 hover:text-brand-300" @click="applyPreset('all')">全选</button>
                  </div>
                </div>

                <div class="space-y-3 max-h-64 overflow-y-auto pr-1">
                  <div v-for="grp in scopeGroups" :key="grp.group">
                    <p class="text-[11px] font-semibold text-slate-500 mb-1.5">{{ grp.group }}</p>
                    <div class="space-y-1.5">
                      <label
                        v-for="s in grp.items"
                        :key="s.key"
                        class="flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-colors"
                        :class="createForm.scopes.includes(s.key)
                          ? (s.dangerous ? 'border-red-500/40 bg-red-500/5' : 'border-brand-500/40 bg-brand-500/5')
                          : 'border-slate-800/60 hover:border-slate-700'"
                      >
                        <input v-model="createForm.scopes" type="checkbox" :value="s.key" class="mt-0.5 accent-brand-500" />
                        <span class="min-w-0">
                          <span class="text-xs" :class="s.dangerous ? 'text-red-300' : 'text-slate-200'">
                            {{ s.label }}
                            <span v-if="s.dangerous" class="ml-1 text-[10px] text-red-400">高危</span>
                          </span>
                          <span class="block text-[11px] text-slate-600">{{ s.desc }}</span>
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                <p v-if="hasDangerousSelected" class="mt-2 text-[11px] text-red-400">
                  已勾选删除类权限，该凭证泄露会导致数据不可逆丢失，请确认对接方确有此需求
                </p>
              </div>

              <!-- 有效期 -->
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase">有效期</label>
                <div class="flex items-center gap-3">
                  <input
                    v-model.number="createForm.expiresInDays"
                    type="number" min="1" :max="meta?.maxExpireDays || 1825"
                    class="form-input text-sm w-28"
                    :disabled="createForm.neverExpire"
                  />
                  <span class="text-xs text-slate-500">天</span>
                  <label class="flex items-center gap-2 text-xs text-slate-400 cursor-pointer ml-2">
                    <input v-model="createForm.neverExpire" type="checkbox" class="accent-brand-500" />
                    永不过期
                  </label>
                </div>
              </div>

              <!-- 二次验密 -->
              <div class="pt-1 border-t border-slate-800/60">
                <label class="block text-xs font-medium text-slate-400 mb-2 mt-3 uppercase">你的登录密码</label>
                <input
                  v-model="createForm.confirmPassword"
                  type="password" placeholder="签发长期凭证需二次验证身份"
                  class="form-input" autocomplete="current-password"
                  @keyup.enter="submitCreate"
                />
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-ghost" @click="showCreate = false">取消</button>
              <button class="btn btn-primary" :disabled="creating" @click="submitCreate">
                {{ creating ? '签发中...' : '确认签发' }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </ClientOnly>

    <!-- 明文一次性展示 -->
    <ClientOnly>
      <Teleport to="body">
        <div v-if="issuedToken" class="modal-backdrop">
          <div class="modal-content max-w-xl">
            <div class="modal-header">
              <h3 class="text-base font-bold text-slate-100">凭证已生成</h3>
            </div>
            <div class="modal-body space-y-4">
              <div class="p-3 rounded-lg border border-amber-500/40 bg-amber-500/5">
                <p class="text-xs text-amber-300 font-medium">请立即复制保存 —— 关闭后将无法再次查看</p>
                <p class="mt-1 text-[11px] text-amber-400/70">
                  系统只保存该凭证的哈希值，无法找回明文。丢失只能吊销后重新签发。
                </p>
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase">{{ issuedName }}</label>
                <div class="p-3 rounded-lg bg-[#070b14] border border-slate-800/60">
                  <code class="text-xs text-brand-300 font-mono break-all select-all">{{ issuedToken }}</code>
                </div>
              </div>
              <button class="btn btn-primary w-full" @click="copyText(issuedToken!, '凭证已复制，请妥善保存')">
                复制凭证
              </button>
            </div>
            <div class="modal-footer">
              <button class="btn btn-ghost" @click="issuedToken = null">我已保存，关闭</button>
            </div>
          </div>
        </div>
      </Teleport>
    </ClientOnly>

    <!-- 编辑模态框 -->
    <ClientOnly>
      <Teleport to="body">
        <div v-if="showEdit" class="modal-backdrop" @click.self="showEdit = false">
          <div class="modal-content max-w-2xl">
            <div class="modal-header">
              <h3 class="text-base font-bold text-slate-100">编辑凭证</h3>
              <button class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500" @click="showEdit = false">
                <MorphIcon name="x" :size="16" class="pointer-events-none" />
              </button>
            </div>
            <div class="modal-body space-y-5">
              <div class="text-[11px] text-slate-500">
                范围为 <span class="text-slate-300">{{ editing?.scopeLabel }}</span>，不可修改。
                需要更换范围请吊销后重新签发，以免审计日志的历史调用被错误归因。
              </div>

              <div>
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase">凭证名称</label>
                <input v-model="editForm.name" type="text" class="form-input" />
              </div>

              <div>
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase">权限项</label>
                <div class="space-y-3 max-h-56 overflow-y-auto pr-1">
                  <div v-for="grp in scopeGroups" :key="grp.group">
                    <p class="text-[11px] font-semibold text-slate-500 mb-1.5">{{ grp.group }}</p>
                    <div class="space-y-1.5">
                      <label
                        v-for="s in grp.items"
                        :key="s.key"
                        class="flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors"
                        :class="editForm.scopes.includes(s.key)
                          ? (s.dangerous ? 'border-red-500/40 bg-red-500/5' : 'border-brand-500/40 bg-brand-500/5')
                          : 'border-slate-800/60 hover:border-slate-700'"
                      >
                        <input v-model="editForm.scopes" type="checkbox" :value="s.key" class="accent-brand-500" />
                        <span class="text-xs" :class="s.dangerous ? 'text-red-300' : 'text-slate-200'">
                          {{ s.label }}
                          <span v-if="s.dangerous" class="ml-1 text-[10px] text-red-400">高危</span>
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase">有效期</label>
                <div class="space-y-2">
                  <label class="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                    <input v-model="editForm.expiryMode" type="radio" value="keep" class="accent-brand-500" />
                    保持不变（当前：{{ editing?.expiresAt ? fmt(editing.expiresAt) : '永不过期' }}）
                  </label>
                  <label class="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                    <input v-model="editForm.expiryMode" type="radio" value="never" class="accent-brand-500" />
                    改为永不过期
                  </label>
                  <label class="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                    <input v-model="editForm.expiryMode" type="radio" value="days" class="accent-brand-500" />
                    从现在起
                    <input
                      v-model.number="editForm.expiresInDays"
                      type="number" min="1" :max="meta?.maxExpireDays || 1825"
                      class="form-input text-xs py-1 w-20"
                      :disabled="editForm.expiryMode !== 'days'"
                    />
                    天后过期
                  </label>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-ghost" @click="showEdit = false">取消</button>
              <button class="btn btn-primary" @click="submitEdit">保存</button>
            </div>
          </div>
        </div>
      </Teleport>
    </ClientOnly>

    <!-- 吊销确认 -->
    <ClientOnly>
      <Teleport to="body">
        <div v-if="showRevoke" class="modal-backdrop" @click.self="showRevoke = false">
          <div class="modal-content max-w-md">
            <div class="modal-header">
              <h3 class="text-base font-bold text-slate-100">吊销凭证</h3>
              <button class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500" @click="showRevoke = false">
                <MorphIcon name="x" :size="16" class="pointer-events-none" />
              </button>
            </div>
            <div class="modal-body space-y-4">
              <div class="p-3 rounded-lg border border-red-500/40 bg-red-500/5">
                <p class="text-xs text-red-300">
                  即将吊销「{{ revoking?.name }}」，该凭证会立即失效，使用它的第三方系统将全部报错。
                </p>
                <p class="mt-1 text-[11px] text-red-400/70">
                  历史调用日志会保留，但凭证本身无法恢复。只是想临时停用请改用「禁用」。
                </p>
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase">你的登录密码</label>
                <input
                  v-model="revokePassword" type="password"
                  class="form-input" autocomplete="current-password"
                  @keyup.enter="submitRevoke"
                />
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-ghost" @click="showRevoke = false">取消</button>
              <button class="btn btn-danger" :disabled="revokeBusy" @click="submitRevoke">
                {{ revokeBusy ? '处理中...' : '确认吊销' }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </ClientOnly>
  </div>
</template>
