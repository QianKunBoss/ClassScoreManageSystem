<script setup lang="ts">
import { ref, computed } from 'vue'
import { sanitizeHtml } from '~/utils/sanitizeHtml'

definePageMeta({ auth: false })

interface Announcement {
  id: number
  title: string
  content: string
  type: 'info' | 'warning' | 'important'
  createdAt: string
}

const announcements = ref<Announcement[]>([])
const announcementsLoading = ref(true)

const sanitizedAnnouncements = computed(() =>
  announcements.value.map(a => ({
    ...a,
    safeContent: sanitizeHtml(a.content),
  }))
)

// 加载公告
async function loadAnnouncements() {
  announcementsLoading.value = true
  try {
    const res = await $fetch<{ success: boolean, data: Announcement[] }>('/api/announcements')
    announcements.value = res.data || []
  } catch {
    announcements.value = []
  } finally {
    announcementsLoading.value = false
  }
}

onMounted(loadAnnouncements)

const features = [
  {
    icon: '🏫',
    title: '多级管理架构',
    desc: '支持总系统 → 学校 → 年级 → 班级四级管理，权限清晰，责任明确。上级管理下级，层层把控。',
  },
  {
    icon: '📊',
    title: '实时积分追踪',
    desc: '学生积分实时更新，排行榜自动排序。支持加减分操作，完整记录可追溯。',
  },
  {
    icon: '🪑',
    title: '可视化座位表',
    desc: '拖拽式座位编排，支持分组、行列自定义。直观展示班级座位分布。',
  },
  {
    icon: '⚡',
    title: '快捷模板',
    desc: '预设常用积分模板，一键应用。支持自定义模板，提升日常操作效率。',
  },
  {
    icon: '📈',
    title: '数据统计',
    desc: '多维度数据统计，趋势图表直观展示。帮助老师掌握班级整体情况。',
  },
  {
    icon: '🔒',
    title: '安全可靠',
    desc: '基于 Session 的安全认证，密码 BCrypt 加密存储。操作需二次确认，防止误触。',
  },
]

const steps = [
  { n: '01', title: '学校入驻', desc: '超级管理员审核并通过学校入驻申请，建立学校档案。' },
  { n: '02', title: '搭建架构', desc: '学校管理员创建年级，年级管理员创建班级，层级架构一键搭建。' },
  { n: '03', title: '导入学生', desc: '班级管理员批量导入学生信息，系统自动生成学生档案。' },
  { n: '04', title: '开始使用', desc: '日常积分管理、座位编排、数据统计，全部在线完成。' },
]

const faqs = [
  { q: '这个系统收费吗？', a: '系统完全免费，我们致力于让每所学校都能用上高效的班级化管理工具。' },
  { q: '支持多少学生同时在线？', a: '系统基于 SQLite 轻量数据库，单班级支持数百学生，全校部署可支撑数千人同时使用。' },
  { q: '数据会丢失吗？', a: '系统支持自动备份功能，数据库文件可定期备份到本地或云端，数据安全有保障。' },
  { q: '没有技术背景能用吗？', a: '完全可以！系统界面简洁直观，操作流程符合日常习惯，5分钟即可上手。' },
]

const openFaq = ref(-1)
function toggleFaq(i: number) { openFaq.value = openFaq.value === i ? -1 : i }

// 公告类型样式
function getTypeStyle(type: string) {
  switch (type) {
    case 'warning':
      return 'bg-yellow-500/10 border-yellow-500/20'
    case 'important':
      return 'bg-red-500/10 border-red-500/20'
    default:
      return 'bg-indigo-500/10 border-indigo-500/20'
  }
}

// 公告类型图标
function getTypeIcon(type: string) {
  switch (type) {
    case 'warning':
      return '⚠️'
    case 'important':
      return '🔴'
    default:
      return '📢'
  }
}
</script>

<template>
  <div class="min-h-screen bg-[#0a0a1a]">
    <!-- Hero -->
    <section class="relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent"></div>
      <div class="absolute top-20 left-10 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl"></div>
      <div class="absolute bottom-10 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>

      <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20 text-center">
        <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-sm text-indigo-400 mb-8 animate-fade-in">
          <span class="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
          多租户班级管理系统 · 全新升级
        </div>

        <h1 class="text-4xl md:text-6xl font-extrabold text-slate-100 mb-6 animate-fade-in" style="animation-delay: 0.1s">
          让班级管理<br />
          <span class="gradient-text">更智能、更高效</span>
        </h1>

        <p class="text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in" style="animation-delay: 0.2s">
          CSMS 是一款面向各级学校的班级积分管理系统。<br />
          支持多级管理架构，让积分管理变得简单、透明、有趣。
        </p>

        <div class="flex items-center justify-center gap-4 animate-fade-in" style="animation-delay: 0.3s">
          <NuxtLink to="/apply" class="btn btn-primary text-base px-8 py-3">
            立即申请入驻
          </NuxtLink>
          <NuxtLink to="/login" class="btn btn-ghost text-base px-8 py-3">
            已有账号？登录
          </NuxtLink>
        </div>

        <!-- 预览卡片 -->
        <div class="mt-16 animate-slide-up" style="animation-delay: 0.5s">
          <div class="glass-card p-2 max-w-4xl mx-auto overflow-hidden">
            <div class="rounded-xl bg-slate-900/80 p-6 text-left">
              <div class="flex items-center gap-2 mb-4">
                <div class="w-3 h-3 rounded-full bg-red-500/70"></div>
                <div class="w-3 h-3 rounded-full bg-yellow-500/70"></div>
                <div class="w-3 h-3 rounded-full bg-green-500/70"></div>
                <div class="ml-4 flex-1 h-7 rounded-lg bg-slate-800/60"></div>
              </div>
              <div class="space-y-3">
                <div class="h-4 rounded bg-indigo-500/20 w-1/3"></div>
                <div class="h-3 rounded bg-slate-800/60 w-full"></div>
                <div class="h-3 rounded bg-slate-800/60 w-5/6"></div>
                <div class="h-3 rounded bg-slate-800/60 w-2/3"></div>
                <div class="flex gap-2 mt-4">
                  <div class="h-8 rounded-lg bg-indigo-500/20 w-20"></div>
                  <div class="h-8 rounded-lg bg-slate-800/60 w-20"></div>
                  <div class="h-8 rounded-lg bg-slate-800/60 w-20"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 公告区域 -->
    <section v-if="announcements.length > 0 || announcementsLoading" class="border-t border-slate-800/50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-lg font-bold text-slate-100">📢 系统公告</h2>
        </div>
        <div v-if="announcementsLoading" class="space-y-3">
          <div v-for="i in 2" :key="i" class="h-16 rounded-xl bg-slate-800/40 animate-pulse"></div>
        </div>
        <div v-else class="space-y-3">
          <div
            v-for="a in sanitizedAnnouncements"
            :key="a.id"
            class="p-4 rounded-xl border transition-all hover:-translate-y-0.5"
            :class="getTypeStyle(a.type)"
          >
            <div class="flex items-start gap-3">
              <span class="text-xl shrink-0">{{ getTypeIcon(a.type) }}</span>
              <div class="flex-1 min-w-0">
                <h3 class="text-sm font-bold text-slate-100 mb-1">{{ a.title }}</h3>
                <p class="text-sm text-slate-400 announcement-content" v-html="a.safeContent"></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 特性 -->
    <section class="border-t border-slate-800/50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div class="text-center mb-14">
          <h2 class="text-2xl md:text-3xl font-bold text-slate-100 mb-3">为什么选择 CSMS？</h2>
          <p class="text-slate-500 max-w-xl mx-auto">从学校到班级，每一层都有专属管理面板，权限分明，操作高效。</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            v-for="(f, i) in features"
            :key="i"
            class="glass-card p-6 animate-slide-up hover:border-indigo-500/20 hover:-translate-y-1 transition-all duration-300"
            :style="`animation-delay: ${i * 0.1}s`"
          >
            <div class="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-2xl mb-4">
              {{ f.icon }}
            </div>
            <h3 class="text-base font-bold text-slate-100 mb-2">{{ f.title }}</h3>
            <p class="text-sm text-slate-500 leading-relaxed">{{ f.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 使用流程 -->
    <section class="border-t border-slate-800/50 bg-slate-900/30">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div class="text-center mb-14">
          <h2 class="text-2xl md:text-3xl font-bold text-slate-100 mb-3">四步快速上手</h2>
          <p class="text-slate-500">从入驻到使用，全程引导，无需技术背景</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div
            v-for="(s, i) in steps"
            :key="i"
            class="relative animate-slide-up"
            :style="`animation-delay: ${i * 0.15}s`"
          >
            <div class="glass-card p-6 text-center h-full">
              <div class="text-5xl font-extrabold text-indigo-500/10 mb-4">{{ s.n }}</div>
              <h3 class="text-base font-bold text-slate-100 mb-2">{{ s.title }}</h3>
              <p class="text-sm text-slate-500 leading-relaxed">{{ s.desc }}</p>
            </div>
            <!-- 箭头（桌面端） -->
            <div v-if="i < steps.length - 1" class="hidden lg:block absolute top-1/2 -right-3 transform -translate-y-1/2 text-slate-700 text-2xl">→</div>
          </div>
        </div>
      </div>
    </section>

    <!-- 架构说明 -->
    <section class="border-t border-slate-800/50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div class="text-center mb-14">
          <h2 class="text-2xl md:text-3xl font-bold text-slate-100 mb-3">清晰的多级权限架构</h2>
          <p class="text-slate-500 max-w-xl mx-auto">每一级管理员只能管理自己的下级，保证数据安全和管理规范</p>
        </div>

        <div class="max-w-3xl mx-auto">
          <div class="space-y-4">
            <div class="glass-card p-5 flex items-center gap-5 animate-slide-up">
              <div class="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-xl flex-shrink-0">👑</div>
              <div class="flex-1">
                <h3 class="text-base font-bold text-slate-100">超级管理员</h3>
                <p class="text-sm text-slate-500">管理所有学校，审核入驻申请，系统全局配置</p>
              </div>
              <div class="text-xs text-slate-600 bg-slate-800/40 px-2 py-1 rounded">总系统</div>
            </div>

            <div class="glass-card p-5 flex items-center gap-5 animate-slide-up" style="animation-delay: 0.1s">
              <div class="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-xl flex-shrink-0">🏫</div>
              <div class="flex-1">
                <h3 class="text-base font-bold text-slate-100">学校管理员</h3>
                <p class="text-sm text-slate-500">管理本校年级，配置学校信息，管理年级管理员账号</p>
              </div>
              <div class="text-xs text-slate-600 bg-slate-800/40 px-2 py-1 rounded">学校</div>
            </div>

            <div class="glass-card p-5 flex items-center gap-5 animate-slide-up" style="animation-delay: 0.2s">
              <div class="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-xl flex-shrink-0">📚</div>
              <div class="flex-1">
                <h3 class="text-base font-bold text-slate-100">年级管理员</h3>
                <p class="text-sm text-slate-500">管理本年级班级，创建班级，管理班级管理员账号</p>
              </div>
              <div class="text-xs text-slate-600 bg-slate-800/40 px-2 py-1 rounded">年级</div>
            </div>

            <div class="glass-card p-5 flex items-center gap-5 animate-slide-up" style="animation-delay: 0.3s">
              <div class="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-xl flex-shrink-0">👨🏫</div>
              <div class="flex-1">
                <h3 class="text-base font-bold text-slate-100">班级管理员（班主任）</h3>
                <p class="text-sm text-slate-500">管理本班学生，日常积分操作、座位编排、数据统计</p>
              </div>
              <div class="text-xs text-slate-600 bg-slate-800/40 px-2 py-1 rounded">班级</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section class="border-t border-slate-800/50 bg-slate-900/30">
      <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div class="text-center mb-14">
          <h2 class="text-2xl md:text-3xl font-bold text-slate-100 mb-3">常见问题</h2>
        </div>

        <div class="space-y-3">
          <div
            v-for="(item, i) in faqs"
            :key="i"
            class="glass-card overflow-hidden animate-slide-up"
            :style="`animation-delay: ${i * 0.1}s`"
          >
            <button
              @click="toggleFaq(i)"
              class="w-full flex items-center justify-between p-5 text-left"
            >
              <span class="text-sm font-medium text-slate-200">{{ item.q }}</span>
              <span class="text-indigo-400 text-lg transition-transform" :class="{ 'rotate-180': openFaq === i }">▼</span>
            </button>
            <div v-if="openFaq === i" class="px-5 pb-5 text-sm text-slate-500 leading-relaxed animate-fade-in">
              {{ item.a }}
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="border-t border-slate-800/50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h2 class="text-2xl md:text-3xl font-bold text-slate-100 mb-4">准备好提升班级管理效率了吗？</h2>
        <p class="text-slate-500 mb-8 max-w-xl mx-auto">联系超级管理员获取入驻资格，开启智能化班级管理新时代。</p>
        <div class="flex items-center justify-center gap-4">
          <NuxtLink to="/apply" class="btn btn-primary text-base px-8 py-3">立即申请入驻</NuxtLink>
          <NuxtLink to="/login" class="btn btn-ghost text-base px-8 py-3">已有账号？登录</NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.announcement-content :deep(a) {
  color: #818cf8;
  text-decoration: underline;
  text-underline-offset: 2px;
  opacity: 0.9;
}

.announcement-content :deep(a:hover) {
  opacity: 1;
}

.announcement-content :deep(b),
.announcement-content :deep(strong) {
  font-weight: 700;
  color: #e2e8f0;
}

.announcement-content :deep(i),
.announcement-content :deep(em) {
  font-style: italic;
}

.announcement-content :deep(u) {
  text-decoration: underline;
}

.announcement-content :deep(br) {
  content: '';
  display: block;
  margin: 0.25rem 0;
}

.announcement-content :deep(p) {
  margin: 0.5rem 0;
}

.announcement-content :deep(p:first-child) {
  margin-top: 0;
}

.announcement-content :deep(p:last-child) {
  margin-bottom: 0;
}

.announcement-content :deep(ul),
.announcement-content :deep(ol) {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}

.announcement-content :deep(li) {
  margin: 0.25rem 0;
}

.announcement-content :deep(code) {
  background: rgba(30, 41, 59, 0.5);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.875em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.announcement-content :deep(hr) {
  border: none;
  border-top: 1px solid rgba(71, 85, 105, 0.3);
  margin: 0.75rem 0;
}

.announcement-content :deep(h1),
.announcement-content :deep(h2),
.announcement-content :deep(h3),
.announcement-content :deep(h4),
.announcement-content :deep(h5),
.announcement-content :deep(h6) {
  font-weight: 700;
  color: #e2e8f0;
  margin: 0.5rem 0;
}

.announcement-content :deep(h1) { font-size: 1.25rem; }
.announcement-content :deep(h2) { font-size: 1.125rem; }
.announcement-content :deep(h3) { font-size: 1rem; }
.announcement-content :deep(h4) { font-size: 0.95rem; }
.announcement-content :deep(h5) { font-size: 0.9rem; }
.announcement-content :deep(h6) { font-size: 0.85rem; }

.announcement-content :deep(blockquote) {
  border-left: 3px solid rgba(99, 102, 241, 0.4);
  padding-left: 0.75rem;
  margin: 0.5rem 0;
  color: #94a3b8;
  font-style: italic;
}
</style>
