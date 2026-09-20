<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { useToast } from '~/composables/useToast'

const { user } = useAuth()
const toast = useToast()
const isSuper = computed(() => user.value?.role === 'super_admin')
const mySchoolId = computed(() => user.value?.schoolId ?? null)

const tabs = [
  { key: 'stats', label: '系统数据' },
  { key: 'import', label: '数据导入' },
  { key: 'export', label: '数据导出' },
  { key: 'backup', label: '备份与恢复' },
] as const
type TabKey = typeof tabs[number]['key']
const activeTab = ref<TabKey>('stats')

// ============ 系统数据 ============
const loadingStats = ref(false)
const stats = ref<any>(null)
const activity = ref<any>(null)
const schools = ref<{ id: number; name: string }[]>([])
const targetSchoolId = ref<number | null>(null) // 超管选择器：null=全部

async function loadSchools() {
  if (!isSuper.value) return
  try {
    const res = await $fetch<{ data: any[] }>('/api/schools', { params: { includeDisabled: '1' } })
    schools.value = res.data || []
  } catch {}
}

async function loadStats() {
  loadingStats.value = true
  try {
    const q: any = {}
    if (isSuper.value && targetSchoolId.value) q.schoolId = targetSchoolId.value
    const [s, a] = await Promise.all([
      $fetch('/api/data/stats', { params: q }),
      $fetch('/api/data/activity', { params: q }),
    ])
    stats.value = s
    activity.value = a
    await nextTick()
    if (activeTab.value === 'stats') renderCharts()
  } catch (e: any) {
    toast.error(e?.data?.message || '加载统计数据失败')
  } finally {
    loadingStats.value = false
  }
}

watch(activeTab, (t) => { if (t === 'stats' && stats.value) nextTick(renderCharts) })
watch(targetSchoolId, () => { if (activeTab.value === 'stats') loadStats() })

// ---------- Chart.js ----------
let charts: Record<string, any> = {}
const elStudents = ref<HTMLCanvasElement | null>(null)
const elTrend = ref<HTMLCanvasElement | null>(null)
const elBuckets = ref<HTMLCanvasElement | null>(null)
const elRoles = ref<HTMLCanvasElement | null>(null)
const elApps = ref<HTMLCanvasElement | null>(null)

const PALETTE = ['#4a7ab5', '#5b8fc7', '#7aa6d6', '#9bbfe6', '#c2cfe0', '#8b99b0']

async function renderCharts() {
  if (!stats.value) return
  const Chart = (await import('chart.js/auto')).default
  Object.values(charts).forEach((c) => c?.destroy())
  charts = {}

  const c = stats.value.charts
  if (elStudents.value && c.studentsBySchool?.length) {
    charts.students = new Chart(elStudents.value, {
      type: 'bar',
      data: { labels: c.studentsBySchool.map((d: any) => d.name), datasets: [{ label: '学生数', data: c.studentsBySchool.map((d: any) => d.value), backgroundColor: PALETTE[0] }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
    })
  }
  if (elTrend.value && c.scoreTrend?.length) {
    charts.trend = new Chart(elTrend.value, {
      type: 'line',
      data: { labels: c.scoreTrend.map((d: any) => d.date.slice(5)), datasets: [{ label: '积分记录数', data: c.scoreTrend.map((d: any) => d.value), borderColor: PALETTE[0], backgroundColor: 'rgba(74,122,181,0.15)', fill: true, tension: 0.3 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
    })
  }
  if (elBuckets.value && c.scoreBuckets?.length) {
    charts.buckets = new Chart(elBuckets.value, {
      type: 'bar',
      data: { labels: c.scoreBuckets.map((d: any) => d.label), datasets: [{ label: '学生数', data: c.scoreBuckets.map((d: any) => d.value), backgroundColor: PALETTE[2] }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { autoSkip: false } } } },
    })
  }
  if (elRoles.value && c.roleDistribution?.length) {
    charts.roles = new Chart(elRoles.value, {
      type: 'doughnut',
      data: { labels: c.roleDistribution.map((d: any) => d.label), datasets: [{ data: c.roleDistribution.map((d: any) => d.value), backgroundColor: PALETTE }] },
      options: { responsive: true, maintainAspectRatio: false },
    })
  }
  if (elApps.value && c.applicationStatus?.length) {
    charts.apps = new Chart(elApps.value, {
      type: 'doughnut',
      data: { labels: c.applicationStatus.map((d: any) => d.label), datasets: [{ data: c.applicationStatus.map((d: any) => d.value), backgroundColor: PALETTE }] },
      options: { responsive: true, maintainAspectRatio: false },
    })
  }
}

// ============ 数据导入 ============
const importType = ref<'students' | 'scores' | 'grades-classes'>('students')
const importFile = ref<File | null>(null)
const preview = ref<any>(null)
const importing = ref(false)

const TEMPLATES: Record<string, { headers: string[]; rows: string[][] }> = {
  students: { headers: ['年级', '班级', '账号', '姓名', '密码', '邮箱'], rows: [['高一', '1班', '2024001', '张三', 'Classfire123', 'zhangsan@example.com']] },
  scores: { headers: ['年级', '班级', '账号', '分值', '说明'], rows: [['高一', '1班', '2024001', '5', '课堂表现']] },
  'grades-classes': { headers: ['年级', '班级'], rows: [['高一', '1班'], ['高一', '2班']] },
}

function downloadTemplate() {
  const t = TEMPLATES[importType.value]
  const csv = '﻿' + [t.headers.join(','), ...t.rows.map((r) => r.join(','))].join('\r\n')
  downloadFile(csv, `classfire-导入模板-${importType.value}.csv`)
}

function onImportFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  importFile.value = f || null
  preview.value = null
}

async function parsePreview() {
  if (!importFile.value) { toast.error('请先选择 CSV 文件'); return }
  const csv = await importFile.value.text()
  importing.value = true
  try {
    const res = await $fetch('/api/data/import/preview', { method: 'POST', body: { type: importType.value, csv } })
    preview.value = res
  } catch (e: any) {
    toast.error(e?.data?.message || '解析失败')
  } finally {
    importing.value = false
  }
}

async function doImport() {
  if (!preview.value || preview.value.accepted === 0) return
  importing.value = true
  try {
    const rows = preview.value.rows.filter((r: any) => r.status === 'ok').map((r: any) => r.data)
    const res = await $fetch('/api/data/import/commit', { method: 'POST', body: { type: importType.value, rows } })
    toast.success(`导入完成：成功 ${res.inserted} 条，跳过 ${res.skipped} 条`)
    preview.value = null
    importFile.value = null
    loadStats()
  } catch (e: any) {
    toast.error(e?.data?.message || '导入失败')
  } finally {
    importing.value = false
  }
}

// ============ 数据导出 ============
const exportTypes = ref<string[]>(['students'])
const EXPORT_OPTIONS = [
  { key: 'students', label: '学生档案' },
  { key: 'scores', label: '积分记录' },
  { key: 'grades-classes', label: '年级/班级' },
  { key: 'admins', label: '管理员' },
  { key: 'applications', label: '入驻申请' },
  { key: 'announcements', label: '公告' },
  { key: 'schools', label: '学校' },
]
const exporting = ref(false)

async function doExport() {
  if (!exportTypes.value.length) { toast.error('请至少选择一项导出内容'); return }
  exporting.value = true
  try {
    for (const type of exportTypes.value) {
      const q: any = { type }
      if (isSuper.value && targetSchoolId.value) q.schoolId = targetSchoolId.value
      const csv = await $fetch(`/api/data/export`, { params: q, responseType: 'text' })
      downloadFile(csv, `classfire-export-${type}-${new Date().toISOString().slice(0, 10)}.csv`)
      await new Promise((r) => setTimeout(r, 300))
    }
    toast.success('导出完成')
  } catch (e: any) {
    toast.error(e?.data?.message || '导出失败')
  } finally {
    exporting.value = false
  }
}

// ============ 备份与恢复 ============
const restoring = ref(false)
const restoreFile = ref<File | null>(null)
const showRestoreConfirm = ref(false)

async function doBackup() {
  try {
    const bundle = await $fetch('/api/data/backup', { method: 'POST', responseType: 'json' })
    downloadFile(JSON.stringify(bundle, null, 2), `classfire-backup-${isSuper.value ? 'full' : 'school'}-${new Date().toISOString().slice(0, 10)}.json`, 'application/json')
    toast.success('备份已生成并开始下载')
  } catch (e: any) {
    toast.error(e?.data?.message || '备份失败')
  }
}

function onRestoreFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  restoreFile.value = f || null
}

async function confirmRestore() {
  if (!restoreFile.value) { toast.error('请选择备份文件'); return }
  const text = await restoreFile.value.text()
  let backup: any
  try {
    backup = JSON.parse(text)
  } catch {
    toast.error('备份文件不是合法的 JSON'); return
  }
  restoring.value = true
  try {
    const res = await $fetch('/api/data/restore', { method: 'POST', body: { backup, confirm: true } })
    toast.success(`恢复完成：学校 ${res.restoredSchools} 个，表 ${res.restoredTables} 张，记录 ${res.restoredRows} 条`)
    restoreFile.value = null
    loadStats()
  } catch (e: any) {
    toast.error(e?.data?.message || '恢复失败')
  } finally {
    restoring.value = false
    showRestoreConfirm.value = false
  }
}

// ============ 工具 ============
function downloadFile(content: string, filename: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const statusBadge = (v: number) => (v === 1 ? 'bg-red-500/15 text-red-400' : 'bg-emerald-500/15 text-emerald-400')
const fmt = (d?: string) => (d ? new Date(d).toLocaleString('zh-CN') : '-')

onMounted(() => { loadSchools(); loadStats() })
onBeforeUnmount(() => { Object.values(charts).forEach((c) => c?.destroy()); charts = {} })
</script>

<template>
  <div>
    <section class="border-b border-slate-800/50">
      <div class="px-4 sm:px-6 lg:px-8 py-6">
        <h1 class="text-xl font-bold text-slate-100 mb-1 flex items-center gap-2">
          <MorphIcon name="database" :size="20" class="text-brand-400" /> 数据收纳
        </h1>
        <p class="text-sm text-slate-500">系统数据总览、数据导入导出、整机备份与恢复</p>
      </div>
    </section>

    <!-- Tab 切换 -->
    <div class="px-4 sm:px-6 lg:px-8 pt-4">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="t in tabs" :key="t.key"
          @click="activeTab = t.key"
          class="px-4 py-2 rounded-lg text-sm font-medium transition-all"
          :class="activeTab === t.key ? 'bg-brand-500/15 text-brand-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'"
        >{{ t.label }}</button>
        <div v-if="isSuper" class="ml-auto flex items-center gap-2 text-sm text-slate-400">
          <span>学校范围</span>
          <select v-model="targetSchoolId" class="bg-slate-800/60 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200">
            <option :value="null">全部学校</option>
            <option v-for="s in schools" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </div>
      </div>
    </div>

    <section class="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <!-- ================= 系统数据 ================= -->
      <div v-if="activeTab === 'stats'">
        <div v-if="loadingStats" class="text-slate-500 text-sm py-8 text-center">加载中…</div>
        <template v-else-if="stats">
          <!-- 概览卡片 -->
          <div class="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
            <div v-for="card in [
              { label: '学生总数', value: stats.overview.totalStudents, icon: 'users' },
              { label: '积分记录', value: stats.overview.totalLogs, icon: 'clipboard-list' },
              { label: '总积分', value: stats.overview.totalScoreSum, icon: 'trending-up' },
              { label: '平均分', value: stats.overview.avgScore, icon: 'bar-chart-3' },
              { label: '年级/班级', value: stats.overview.totalGrades + '/' + stats.overview.totalClasses, icon: 'graduation-cap' },
              { label: '已封禁', value: stats.overview.totalDisabled, icon: 'ban' },
            ]" :key="card.label" class="glass-card p-4">
              <div class="flex items-center gap-2 text-brand-400 mb-2"><MorphIcon :name="card.icon" :size="16" /></div>
              <p class="text-2xl font-bold text-slate-100 tabular-nums">{{ card.value }}</p>
              <p class="text-xs text-slate-500 mt-0.5">{{ card.label }}</p>
            </div>
          </div>

          <!-- 图表 -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <div class="glass-card p-5">
              <h3 class="text-sm font-bold text-slate-100 mb-3">各校学生数</h3>
              <div class="h-64"><canvas ref="elStudents"></canvas></div>
            </div>
            <div class="glass-card p-5">
              <h3 class="text-sm font-bold text-slate-100 mb-3">近 14 天积分记录趋势</h3>
              <div class="h-64"><canvas ref="elTrend"></canvas></div>
            </div>
            <div class="glass-card p-5">
              <h3 class="text-sm font-bold text-slate-100 mb-3">学生积分分布</h3>
              <div class="h-64"><canvas ref="elBuckets"></canvas></div>
            </div>
            <div v-if="stats.charts.roleDistribution?.length" class="glass-card p-5">
              <h3 class="text-sm font-bold text-slate-100 mb-3">管理员角色分布</h3>
              <div class="h-64"><canvas ref="elRoles"></canvas></div>
            </div>
            <div v-if="stats.charts.applicationStatus?.length" class="glass-card p-5">
              <h3 class="text-sm font-bold text-slate-100 mb-3">入驻申请状态</h3>
              <div class="h-64"><canvas ref="elApps"></canvas></div>
            </div>
          </div>

          <!-- 每校明细 -->
          <div class="glass-card p-5 mt-4">
            <h3 class="text-sm font-bold text-slate-100 mb-3">各校明细</h3>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead><tr class="text-slate-500 text-left">
                  <th class="py-2 pr-4">学校</th><th class="py-2 pr-4">学生</th><th class="py-2 pr-4">年级/班级</th>
                  <th class="py-2 pr-4">积分记录</th><th class="py-2 pr-4">总积分</th><th class="py-2 pr-4">平均分</th><th class="py-2 pr-4">已封禁</th><th class="py-2 pr-4">已绑定邮箱</th>
                </tr></thead>
                <tbody>
                  <tr v-for="sc in stats.schools" :key="sc.id" class="border-t border-slate-800/50">
                    <td class="py-2 pr-4 text-slate-200">{{ sc.name }}</td>
                    <td class="py-2 pr-4 tabular-nums">{{ sc.studentCount }}</td>
                    <td class="py-2 pr-4 tabular-nums">{{ sc.gradeCount }}/{{ sc.classCount }}</td>
                    <td class="py-2 pr-4 tabular-nums">{{ sc.logCount }}</td>
                    <td class="py-2 pr-4 tabular-nums">{{ sc.totalScore }}</td>
                    <td class="py-2 pr-4 tabular-nums">{{ sc.avgScore }}</td>
                    <td class="py-2 pr-4 tabular-nums">{{ sc.disabledStudentCount }}</td>
                    <td class="py-2 pr-4 tabular-nums">{{ sc.emailBoundCount }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- 明细记录 -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <div class="glass-card p-5">
              <h3 class="text-sm font-bold text-slate-100 mb-3">最近积分记录</h3>
              <div class="space-y-1 max-h-80 overflow-y-auto">
                <div v-for="l in activity?.scoreLogs" :key="l.id" class="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/40 text-sm">
                  <span class="text-xs px-2 py-0.5 rounded-full" :class="l.scoreChange >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'">{{ l.scoreChange >= 0 ? '+' : '' }}{{ l.scoreChange }}</span>
                  <span class="text-slate-200 flex-1 truncate">{{ l.username }} · {{ l.description || '—' }}</span>
                  <span class="text-xs text-slate-500 shrink-0">{{ l.schoolName }}</span>
                </div>
                <div v-if="!activity?.scoreLogs?.length" class="text-slate-500 text-sm py-4 text-center">暂无记录</div>
              </div>
            </div>
            <div class="glass-card p-5">
              <h3 class="text-sm font-bold text-slate-100 mb-3">最近新增学生</h3>
              <div class="space-y-1 max-h-80 overflow-y-auto">
                <div v-for="u in activity?.newStudents" :key="u.id" class="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/40 text-sm">
                  <span class="w-7 h-7 rounded-full bg-brand-500/10 flex items-center justify-center text-xs text-brand-400 font-bold shrink-0">{{ (u.actualName || u.username).slice(0, 1) }}</span>
                  <span class="text-slate-200 flex-1 truncate">{{ u.actualName || u.username }}</span>
                  <span class="text-xs text-slate-500 shrink-0">{{ u.className || '—' }} · {{ u.schoolName }}</span>
                </div>
                <div v-if="!activity?.newStudents?.length" class="text-slate-500 text-sm py-4 text-center">暂无记录</div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- ================= 数据导入 ================= -->
      <div v-else-if="activeTab === 'import'" class="space-y-4">
        <div class="glass-card p-5 space-y-4">
          <div class="flex flex-wrap items-center gap-3">
            <div class="flex gap-2">
              <button v-for="opt in [{k:'students',l:'学生档案'},{k:'scores',l:'积分记录'},{k:'grades-classes',l:'年级/班级结构'}]" :key="opt.k"
                @click="importType = opt.k as any; preview = null"
                class="px-3 py-1.5 rounded-lg text-sm" :class="importType === opt.k ? 'bg-brand-500/15 text-brand-400' : 'text-slate-400 hover:bg-slate-800/40'">{{ opt.l }}</button>
            </div>
            <button @click="downloadTemplate" class="ml-auto btn btn-ghost text-sm"><MorphIcon name="file-plus" :size="14" class="mr-1" />下载模板</button>
          </div>
          <div class="border-2 border-dashed border-slate-700 rounded-xl p-6 text-center">
            <input type="file" accept=".csv,text/csv" @change="onImportFile" class="hidden" id="importFile" />
            <label for="importFile" class="cursor-pointer inline-flex items-center gap-2 text-brand-400 hover:text-brand-300">
              <MorphIcon name="upload" :size="18" /> 选择 CSV 文件
            </label>
            <p v-if="importFile" class="text-xs text-slate-400 mt-2">{{ importFile.name }}</p>
            <p class="text-xs text-slate-500 mt-2">支持表头中文或英文（账号/姓名/年级/班级/密码/邮箱/分值/说明）</p>
          </div>
          <div class="flex gap-2">
            <button @click="parsePreview" :disabled="!importFile || importing" class="btn btn-primary text-sm">解析并校验</button>
          </div>
        </div>

        <div v-if="preview" class="glass-card p-5">
          <div class="flex items-center gap-3 mb-3">
            <span class="text-sm text-slate-300">校验结果：</span>
            <span class="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">通过 {{ preview.accepted }}</span>
            <span class="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">错误 {{ preview.rejected }}</span>
            <span class="text-xs text-slate-500">共 {{ preview.total }} 行</span>
            <button @click="doImport" :disabled="preview.accepted === 0 || importing" class="ml-auto btn btn-primary text-sm"><MorphIcon name="check" :size="14" class="mr-1" />确认导入 {{ preview.accepted }} 条</button>
          </div>
          <div class="overflow-x-auto max-h-96">
            <table class="w-full text-sm">
              <thead><tr class="text-slate-500 text-left">
                <th class="py-2 pr-4">行号</th><th class="py-2 pr-4">状态</th>
                <th class="py-2 pr-4">关键信息</th><th class="py-2 pr-4">错误说明</th>
              </tr></thead>
              <tbody>
                <tr v-for="r in preview.rows" :key="r.index" class="border-t border-slate-800/50" :class="r.status === 'error' ? 'bg-red-500/5' : ''">
                  <td class="py-1.5 pr-4 tabular-nums text-slate-500">{{ r.index }}</td>
                  <td class="py-1.5 pr-4">
                    <span class="text-xs px-2 py-0.5 rounded-full" :class="r.status === 'ok' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'">{{ r.status === 'ok' ? '通过' : '错误' }}</span>
                  </td>
                  <td class="py-1.5 pr-4 text-slate-300">
                    <template v-if="importType === 'students'">{{ r.data.username }} / {{ r.data.actualName }} / {{ r.data.className || '—' }}</template>
                    <template v-else-if="importType === 'scores'">{{ r.data.username }} / {{ r.data.scoreChange }}</template>
                    <template v-else>{{ r.data.gradeName }} / {{ r.data.className || '—' }}</template>
                  </td>
                  <td class="py-1.5 pr-4 text-red-400 text-xs">{{ r.errors.join('；') }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ================= 数据导出 ================= -->
      <div v-else-if="activeTab === 'export'" class="glass-card p-5 space-y-4">
        <p class="text-sm text-slate-400">选择需要导出的数据范围，生成 CSV 通用格式文件（便于存档或在其他系统中使用）。</p>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          <label v-for="opt in EXPORT_OPTIONS" :key="opt.key" class="flex items-center gap-2 p-3 rounded-lg bg-slate-800/40 hover:bg-slate-800/70 cursor-pointer text-sm">
            <input type="checkbox" :value="opt.key" v-model="exportTypes" class="accent-brand-500" />
            <span class="text-slate-200">{{ opt.label }}</span>
          </label>
        </div>
        <button @click="doExport" :disabled="exporting || !exportTypes.length" class="btn btn-primary text-sm"><MorphIcon name="download" :size="14" class="mr-1" />导出选中（CSV）</button>
        <p class="text-xs text-slate-500">{{ isSuper ? '当前范围：' + (targetSchoolId ? schools.find(s=>s.id===targetSchoolId)?.name : '全部学校') : '当前范围：您管理的学校' }}</p>
      </div>

      <!-- ================= 备份与恢复 ================= -->
      <div v-else-if="activeTab === 'backup'" class="space-y-4">
        <div class="glass-card p-5">
          <h3 class="text-sm font-bold text-slate-100 mb-2 flex items-center gap-2"><MorphIcon name="download" :size="16" class="text-brand-400" />整机备份</h3>
          <p class="text-sm text-slate-400 mb-4">
            {{ isSuper ? '将主库与全部学校库完整打包为 JSON 文件，可用于数据迁移至新环境。' : '将本校数据库完整打包为 JSON 文件。' }}
          </p>
          <button @click="doBackup" class="btn btn-primary text-sm"><MorphIcon name="download" :size="14" class="mr-1" />生成并下载备份</button>
        </div>

        <div class="glass-card p-5">
          <h3 class="text-sm font-bold text-slate-100 mb-2 flex items-center gap-2"><MorphIcon name="upload" :size="16" class="text-brand-400" />从备份恢复</h3>
          <p class="text-sm text-slate-400 mb-4">
            上传此前生成的备份文件以恢复数据。<span class="text-red-400">该操作会覆盖当前同名数据，且不可撤销，请谨慎操作。</span>
          </p>
          <input type="file" accept=".json,application/json" @change="onRestoreFile" class="hidden" id="restoreFile" />
          <div class="flex items-center gap-3">
            <label for="restoreFile" class="btn btn-ghost text-sm cursor-pointer"><MorphIcon name="upload" :size="14" class="mr-1" />选择备份文件</label>
            <span v-if="restoreFile" class="text-xs text-slate-400">{{ restoreFile.name }}</span>
            <button @click="showRestoreConfirm = true" :disabled="!restoreFile" class="ml-auto btn btn-primary text-sm !bg-red-500/80 hover:!bg-red-500">开始恢复</button>
          </div>
        </div>
      </div>
    </section>

    <UiConfirm
      :show="showRestoreConfirm"
      title="确认恢复数据？"
      :message="`即将用备份文件「${restoreFile?.name || ''}」覆盖当前数据，此操作不可撤销。建议先完成一次备份。`"
      danger
      confirm-text="确认恢复"
      cancel-text="取消"
      @confirm="confirmRestore"
      @cancel="showRestoreConfirm = false"
    />
  </div>
</template>
