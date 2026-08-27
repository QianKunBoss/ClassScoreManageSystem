<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
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

async function loadAnnouncements() {
  announcementsLoading.value = true
  try {
    const res = await $fetch<{ success: boolean, data: Announcement[] }>('/api/announcements')
    announcements.value = res.data || []
  } catch {
    announcements.value = []
  } finally {
    announcementsLoading.value = false
    await nextTick()
    initReveal()
  }
}

onMounted(loadAnnouncements)

const features = [
  { icon: 'school', title: '多级管理架构', desc: '支持总系统 → 学校 → 年级 → 班级四级管理，权限清晰，责任明确。上级管理下级，层层把控。' },
  { icon: 'bar-chart-3', title: '实时积分追踪', desc: '学生积分实时更新，排行榜自动排序。支持加减分操作，完整记录可追溯。' },
  { icon: 'armchair', title: '可视化座位表', desc: '拖拽式座位编排，支持分组、行列自定义。直观展示班级座位分布。' },
  { icon: 'zap', title: '快捷模板', desc: '预设常用积分模板，一键应用。支持自定义模板，提升日常操作效率。' },
  { icon: 'trending-up', title: '数据统计', desc: '多维度数据统计，趋势图表直观展示。帮助老师掌握班级整体情况。' },
  { icon: 'lock', title: '安全可靠', desc: '基于 Session 的安全认证，密码 BCrypt 加密存储。操作需二次确认，防止误触。' },
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

function getTypeStyle(type: string) {
  switch (type) {
    case 'warning': return 'cosmic-warn'
    case 'important': return 'cosmic-danger'
    default: return 'cosmic-info'
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'warning': return 'alert-triangle'
    case 'important': return 'circle'
    default: return 'megaphone'
  }
}

/* 悬浮星尘（固定数据，避免 SSR 水合不一致） */
const stardust = [
  { left: '6%', top: '22%', size: 3, delay: '0s', dur: '14s' },
  { left: '18%', top: '68%', size: 2, delay: '1.2s', dur: '18s' },
  { left: '32%', top: '12%', size: 4, delay: '0.6s', dur: '13s' },
  { left: '45%', top: '80%', size: 2, delay: '2s', dur: '20s' },
  { left: '58%', top: '30%', size: 3, delay: '0.3s', dur: '15s' },
  { left: '70%', top: '55%', size: 4, delay: '1.6s', dur: '17s' },
  { left: '84%', top: '18%', size: 2, delay: '0.9s', dur: '14s' },
  { left: '92%', top: '72%', size: 3, delay: '2.4s', dur: '19s' },
  { left: '12%', top: '42%', size: 2, delay: '1.8s', dur: '16s' },
  { left: '52%', top: '8%', size: 2, delay: '0.1s', dur: '12s' },
  { left: '76%', top: '86%', size: 3, delay: '2.8s', dur: '21s' },
  { left: '40%', top: '48%', size: 2, delay: '3.2s', dur: '15s' },
]

/* ===================== 沉浸式交互 ===================== */
const pageRef = ref<HTMLElement | null>(null)
const heroRef = ref<HTMLElement | null>(null)
const glowRef = ref<HTMLElement | null>(null)
const progressRef = ref<HTMLElement | null>(null)
const reduceMotion = ref(false)

function onMouseMove(e: MouseEvent) {
  const h = heroRef.value
  if (!h) return
  const r = h.getBoundingClientRect()
  const mx = (e.clientX - r.left) / r.width - 0.5
  const my = (e.clientY - r.top) / r.height - 0.5
  h.style.setProperty('--mx', mx.toFixed(4))
  h.style.setProperty('--my', my.toFixed(4))
  if (glowRef.value) {
    glowRef.value.style.transform = `translate(${e.clientX - r.left}px, ${e.clientY - r.top}px)`
  }
}
function onMouseEnter() {
  if (glowRef.value) glowRef.value.style.opacity = '1'
}
function onMouseLeave() {
  const h = heroRef.value
  if (h) { h.style.setProperty('--mx', '0'); h.style.setProperty('--my', '0') }
  if (glowRef.value) glowRef.value.style.opacity = '0'
}

function onHeroClick(e: MouseEvent) {
  const h = heroRef.value
  if (!h || reduceMotion.value) return
  const r = h.getBoundingClientRect()
  const ring = document.createElement('span')
  ring.className = 'ripple'
  ring.style.left = `${e.clientX - r.left}px`
  ring.style.top = `${e.clientY - r.top}px`
  h.appendChild(ring)
  window.setTimeout(() => ring.remove(), 720)
}

/* 星海（纯色实心 + 辉光 + 鼠标视差） */
let canvas: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null
let stars: any[] = []
let shooting: any[] = []
let rafId = 0
let w = 0
let hgt = 0
let gmx = 0
let gmy = 0

function onGlobalMouse(e: MouseEvent) {
  gmx = (e.clientX / window.innerWidth - 0.5) * 2
  gmy = (e.clientY / window.innerHeight - 0.5) * 2
}

function resizeCanvas() {
  if (!canvas) return
  w = canvas.clientWidth
  hgt = canvas.clientHeight
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = w * dpr
  canvas.height = hgt * dpr
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function initStars() {
  const count = Math.min(260, Math.floor((w * hgt) / 5000))
  stars = Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * hgt,
    z: Math.random() * 0.85 + 0.15,
    r: Math.random() * 1.5 + 0.3,
    tw: Math.random() * Math.PI * 2,
    tws: Math.random() * 0.04 + 0.01,
  }))
  shooting = []
}

function spawnShooting() {
  if (Math.random() < 0.014 && shooting.length < 3) {
    shooting.push({
      x: Math.random() * w * 0.7,
      y: Math.random() * hgt * 0.4,
      len: Math.random() * 130 + 80,
      speed: Math.random() * 7 + 6,
      angle: Math.PI / 4 + (Math.random() - 0.5) * 0.3,
    })
  }
}

function draw() {
  if (!ctx) return
  ctx.clearRect(0, 0, w, hgt)
  ctx.shadowBlur = 6
  ctx.shadowColor = 'rgba(150, 180, 215, 0.7)'

  for (const s of stars) {
    s.y += s.z * 0.14
    if (s.y > hgt) { s.y = 0; s.x = Math.random() * w }
    s.tw += s.tws
    const px = s.x - gmx * s.z * 16
    const py = s.y - gmy * s.z * 12
    const alpha = Math.max(0.15, 0.42 + Math.sin(s.tw) * 0.32 + s.z * 0.2)
    ctx.beginPath()
    ctx.arc(px, py, s.r * s.z, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(205, 224, 245, ${alpha.toFixed(3)})`
    ctx.fill()
  }
  ctx.shadowBlur = 0

  spawnShooting()
  for (let i = shooting.length - 1; i >= 0; i--) {
    const sh = shooting[i]
    sh.x += Math.cos(sh.angle) * sh.speed
    sh.y += Math.sin(sh.angle) * sh.speed
    const tailX = sh.x - Math.cos(sh.angle) * sh.len
    const tailY = sh.y - Math.sin(sh.angle) * sh.len
    ctx.strokeStyle = 'rgba(170, 205, 240, 0.85)'
    ctx.shadowBlur = 8
    ctx.shadowColor = 'rgba(170, 205, 240, 0.8)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(sh.x, sh.y)
    ctx.lineTo(tailX, tailY)
    ctx.stroke()
    ctx.shadowBlur = 0
    if (sh.x > w + 50 || sh.y > hgt + 50) shooting.splice(i, 1)
  }

  rafId = requestAnimationFrame(draw)
}

function startStarfield() {
  canvas = document.getElementById('starfield') as HTMLCanvasElement
  if (!canvas) return
  ctx = canvas.getContext('2d')
  if (!ctx) return
  reduceMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  resizeCanvas()
  initStars()
  if (!reduceMotion.value) {
    draw()
  } else {
    ctx.shadowBlur = 4
    ctx.shadowColor = 'rgba(150,180,215,0.6)'
    for (const s of stars) {
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(205,224,245,0.7)'
      ctx.fill()
    }
  }
  window.addEventListener('resize', resizeCanvas)
}

function onScroll() {
  const h = document.documentElement
  const max = h.scrollHeight - h.clientHeight
  const p = max > 0 ? h.scrollTop / max : 0
  if (progressRef.value) progressRef.value.style.width = `${(p * 100).toFixed(2)}%`
  if (pageRef.value) pageRef.value.style.setProperty('--scroll', p.toFixed(4))
}

// ===== 横向滚动区（特性 / 流程 / 架构）：sticky + transform 平移 =====
// 原理（参考一加官网 / 掘金文章）：竖向滚轮 → 外层占位高度撑开 → 内层 sticky 钉住
// → 把容器相对视口的 top 负值映射成横向 translateX，实现"滚动条向下、页面横向移动"
// 小屏 / 减少动态效果：回退为常规纵向堆叠，不做横移
const hwrapRef = ref<HTMLElement | null>(null)
const htrackRef = ref<HTMLElement | null>(null)
const hscrollActive = ref(false)

let hVw = 0
let hVh = 0
let hItemCount = 0
let hMaxTranslate = 0

// 仅宽屏且未开启"减少动态效果"时启用横向滑动；小屏回退纵向
function checkHScroll() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  hscrollActive.value = window.innerWidth >= 1024 && !reduce
  if (hscrollActive.value) setupHScroll()
  else teardownHScroll()
}

// 计算占位高度 + 绑定平移（幂等：重复调用不会重复绑定事件）
let hRevealByScreen: HTMLElement[][] = []
let hActiveScreen = -1
function setupHScroll() {
  const wrap = hwrapRef.value
  const track = htrackRef.value
  if (!wrap || !track) return
  window.removeEventListener('scroll', onHScroll)
  hVw = window.innerWidth
  hVh = window.innerHeight
  hItemCount = track.children.length
  // 占位高度 = (块数 - 1) * 视口宽 + 视口高；最后一块平移距离等于高度而非宽度
  hMaxTranslate = (hItemCount - 1) * hVw
  wrap.style.height = `${hMaxTranslate + hVh}px`
  track.style.transform = 'translateX(0px)'
  // 收集每屏内的 [data-reveal] 元素，按 DOM 顺序（标题块在前、卡片在后）
  hRevealByScreen = Array.from(track.children).map(sec =>
    Array.from(sec.querySelectorAll<HTMLElement>('[data-reveal]'))
  )
  // 初始全部隐藏，等待进入对应屏时序列渐显；并清掉全局 observer 加的 .is-visible，
  // 改由本逻辑的 .in 类驱动（避免宽屏横移区同时命中两种揭示规则）
  hRevealByScreen.forEach(els => els.forEach(el => {
    el.classList.remove('in')
    el.classList.remove('is-visible')
  }))
  hActiveScreen = -1
  window.addEventListener('scroll', onHScroll, { passive: true })
  onHScroll()
}

function teardownHScroll() {
  const wrap = hwrapRef.value
  const track = htrackRef.value
  window.removeEventListener('scroll', onHScroll)
  if (wrap) wrap.style.height = ''
  if (track) track.style.transform = ''
  // 还原：移除横移驱动类，交还给全局 observer 正常渐显（小屏纵向 / 减少动态效果回退）
  hRevealByScreen.forEach(els => els.forEach(el => {
    el.classList.remove('in')
    // 加回 .is-visible：让全局 [data-reveal].is-visible 规则立即生效显示，
    // 即便 observer 已 disconnect 也不影响（类本身即显示态）
    el.classList.add('is-visible')
  }))
  hRevealByScreen = []
  hActiveScreen = -1
}

// 竖向滚动 → 横向平移 + 按屏序列渐显
function onHScroll() {
  const wrap = hwrapRef.value
  const track = htrackRef.value
  if (!wrap || !track) return
  const top = wrap.getBoundingClientRect().top
  if (top > 0) {
    // 容器还没到顶部：保持初始位置
    track.style.transform = 'translateX(0px)'
  } else if (top < -hMaxTranslate) {
    // 已横移到底：锁定在最大位移
    track.style.transform = `translateX(-${hMaxTranslate}px)`
  } else {
    // 区间内：top 为负，直接映射成横向位移
    track.style.transform = `translateX(${top}px)`
  }
  // 计算当前横向进度对应的屏索引
  const p = hMaxTranslate > 0 ? Math.min(1, Math.max(0, -top / hMaxTranslate)) : 0
  const idx = Math.round(p * (hItemCount - 1))
  if (idx !== hActiveScreen) {
    activateScreen(idx)
    hActiveScreen = idx
  }
}

// 仅激活"当前屏"序列渐显；失活屏整体淡出（支持退回）
function activateScreen(idx: number) {
  hRevealByScreen.forEach((els, si) => {
    if (si === idx) {
      // 标题块（首个元素）立即、稍后卡片依次：用递增 transitionDelay 实现"标题先、卡片逐个"
      els.forEach((el, ei) => {
        el.style.transitionDelay = `${ei * 0.1}s`
        el.classList.add('in')
      })
    } else {
      // 退回：移除 .in 并清掉 delay，整体淡出（不反向逐个，避免回滚抖动）
      els.forEach(el => {
        el.style.transitionDelay = '0s'
        el.classList.remove('in')
      })
    }
  })
}

let observer: IntersectionObserver | null = null
function initReveal() {
  // 注意：横移区（.h-track 内）的 [data-reveal] 仍交给全局 observer 正常渐显，
  // 仅在宽屏启用横移（setupHScroll）时由横移逻辑临时接管（移除 .is-visible、改由 .in 驱动）。
  // 小屏 / 减少动态效果下保持原始纵向渐显效果（即横移上线前的表现）。
  const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
  if (!('IntersectionObserver' in window)) {
    els.forEach(el => el.classList.add('is-visible'))
    return
  }
  // 支持重复调用（异步渲染的内容会新增 [data-reveal] 元素，需要重新观察）
  observer?.disconnect()
  observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        ;(e.target as HTMLElement).classList.add('is-visible')
        observer?.unobserve(e.target)
      }
    })
  }, { threshold: 0.12 })
  els.forEach(el => {
    // 已显示的无需重复观察
    if (!el.classList.contains('is-visible')) observer?.observe(el)
  })
}

let magneticEls: HTMLElement[] = []
function initMagnetic() {
  magneticEls = Array.from(document.querySelectorAll<HTMLElement>('[data-magnetic]'))
  magneticEls.forEach(el => {
    el.addEventListener('mousemove', onMagneticMove)
    el.addEventListener('mouseleave', onMagneticLeave)
  })
}
function onMagneticMove(e: Event) {
  if (reduceMotion.value) return
  const el = e.currentTarget as HTMLElement
  const r = el.getBoundingClientRect()
  const dx = (e as MouseEvent).clientX - (r.left + r.width / 2)
  const dy = (e as MouseEvent).clientY - (r.top + r.height / 2)
  el.style.transform = `translate(${(dx * 0.25).toFixed(1)}px, ${(dy * 0.3).toFixed(1)}px)`
}
function onMagneticLeave(e: Event) {
  ;(e.currentTarget as HTMLElement).style.transform = ''
}

let tiltEls: HTMLElement[] = []
function initTilt() {
  tiltEls = Array.from(document.querySelectorAll<HTMLElement>('[data-tilt]'))
  tiltEls.forEach(el => {
    el.addEventListener('mousemove', onTiltMove)
    el.addEventListener('mouseleave', onTiltLeave)
  })
}
function onTiltMove(e: Event) {
  if (reduceMotion.value) return
  const el = e.currentTarget as HTMLElement
  const r = el.getBoundingClientRect()
  const px = (e as MouseEvent).clientX - (r.left + r.width / 2)
  const py = (e as MouseEvent).clientY - (r.top + r.height / 2)
  const rx = (-py / r.height) * 10
  const ry = (px / r.width) * 12
  el.style.transform = `perspective(800px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-4px)`
}
function onTiltLeave(e: Event) {
  ;(e.currentTarget as HTMLElement).style.transform = ''
}

onMounted(() => {
  startStarfield()
  initReveal()
  initMagnetic()
  initTilt()
  onScroll()
  checkHScroll()
  window.addEventListener('mousemove', onGlobalMouse, { passive: true })
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', checkHScroll)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
  window.removeEventListener('resize', resizeCanvas)
  window.removeEventListener('mousemove', onGlobalMouse)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', checkHScroll)
  teardownHScroll()
  observer?.disconnect()
  magneticEls.forEach(el => {
    el.removeEventListener('mousemove', onMagneticMove)
    el.removeEventListener('mouseleave', onMagneticLeave)
  })
  tiltEls.forEach(el => {
    el.removeEventListener('mousemove', onTiltMove)
    el.removeEventListener('mouseleave', onTiltLeave)
  })
})
</script>

<template>
  <div ref="pageRef" class="cosmic-page">
    <canvas id="starfield" class="starfield"></canvas>
    <div class="stardust-layer" aria-hidden="true">
      <span
        v-for="(d, i) in stardust"
        :key="i"
        class="stardust-dot"
        :style="{ left: d.left, top: d.top, width: d.size + 'px', height: d.size + 'px', animationDelay: d.delay, animationDuration: d.dur }"
      ></span>
    </div>
    <div ref="progressRef" class="scroll-progress"></div>

    <!-- ============ HERO ============ -->
    <section
      ref="heroRef"
      class="hero"
      @mousemove="onMouseMove"
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
      @click="onHeroClick"
    >
      <div class="bg-field">
        <div class="nebula nebula-1"></div>
        <div class="nebula nebula-2"></div>
        <div class="nebula nebula-3"></div>
        <div class="grid-floor"></div>
      </div>
      <div class="aurora aurora-1"></div>
      <div class="aurora aurora-2"></div>
      <div ref="glowRef" class="cursor-glow"></div>

      <div class="hero-content">
        <div class="badge-pill animate-fade-in">
          <span class="badge-dot"></span>
          多租户班级管理系统 · 全新升级
        </div>

        <h1 class="hero-title animate-fade-in" style="animation-delay: 0.1s">
          让班级管理<br />
          <span class="accent-text">更智能、更高效</span>
        </h1>

        <p class="hero-sub animate-fade-in" style="animation-delay: 0.2s">
          CSMS 是一款面向各级学校的班级积分管理系统。<br />
          支持多级管理架构，让积分管理变得简单、透明、有趣。
        </p>

        <div class="hero-cta animate-fade-in" style="animation-delay: 0.3s">
          <NuxtLink to="/apply" class="btn-neon" data-magnetic>立即申请入驻</NuxtLink>
          <NuxtLink to="/login" class="btn-ghost-neon" data-magnetic>已有账号？登录</NuxtLink>
          <a
            href="https://github.com/QianKunBoss/ClassScoreManageSystem"
            target="_blank"
            rel="noopener noreferrer"
            class="btn-ghost-neon"
            data-magnetic
          >
            <svg class="gh-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                fill="currentColor"
                d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.3 24 12c0-6.63-5.37-12-12-12z"
              />
            </svg>
            <span>GitHub</span>
          </a>
        </div>

        <!-- 星轨装置 -->
        <div class="orbit-wrap animate-slide-up" style="animation-delay: 0.5s">
          <div class="orbit-ring ring-1"><span class="sat sat-a"></span></div>
          <div class="orbit-ring ring-2"><span class="sat sat-b"></span></div>
          <div class="orbit-ring ring-3"></div>
          <div class="planet"></div>
          <div class="glass-console">
            <div class="console-bar">
              <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
              <span class="console-path">csms://dashboard</span>
            </div>
            <div class="console-body">
              <div class="console-line w-1-3"></div>
              <div class="console-line w-full"></div>
              <div class="console-line w-5-6"></div>
              <div class="console-line w-2-3"></div>
              <div class="console-chips">
                <span class="chip chip-1"></span>
                <span class="chip chip-2"></span>
                <span class="chip chip-3"></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="scroll-indicator">
        <span>向下探索</span>
        <div class="mouse"><span class="wheel"></span></div>
      </div>
    </section>

    <!-- ============ 公告 ============ -->
    <section v-if="announcements.length > 0 || announcementsLoading" class="section">
      <div class="container">
        <h2 class="section-title" data-reveal="up"><span class="title-mark">▰</span> 系统公告</h2>
        <div v-if="announcementsLoading" class="space-y-3">
          <div v-for="i in 2" :key="i" class="hud-panel h-20 pulse"></div>
        </div>
        <div v-else class="space-y-3">
          <div
            v-for="a in sanitizedAnnouncements"
            :key="a.id"
            class="hud-panel"
            :class="getTypeStyle(a.type)"
            data-reveal="up"
          >
            <div class="hud-corner"></div>
            <div class="flex items-start gap-3">
              <span class="text-xl shrink-0"><MorphIcon :name="getTypeIcon(a.type)" size="1em" class="inline-block align-middle" /></span>
              <div class="flex-1 min-w-0">
                <h3 class="hud-title">{{ a.title }}</h3>
                <p class="announcement-content" v-html="a.safeContent"></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ 横向滚动区：特性 / 流程 / 架构 ============ -->
    <div ref="hwrapRef" class="h-scroll" :class="{ 'h-scroll--active': hscrollActive }">
      <div class="h-sticky">
        <div ref="htrackRef" class="h-track">

    <!-- ============ 特性 ============ -->
    <section class="section">
      <div class="container">
        <div class="text-center mb-14" data-reveal="up">
          <h2 class="section-title inline-block">为什么选择 CSMS？</h2>
          <p class="section-sub">从学校到班级，每一层都有专属管理面板，权限分明，操作高效。</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            v-for="(f, i) in features"
            :key="i"
            class="reveal-cell"
            :data-reveal="i % 3 === 1 ? 'scale' : 'up'"
            :style="`transition-delay: ${i * 0.08}s`"
          >
            <div class="neon-card" data-tilt>
              <div class="neon-card-icon"><MorphIcon :name="f.icon" :size="30" /></div>
              <h3 class="neon-card-title">{{ f.title }}</h3>
              <p class="neon-card-desc">{{ f.desc }}</p>
              <span class="scan-line"></span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ 流程 ============ -->
    <section class="section">
      <div class="container">
        <div class="text-center mb-14" data-reveal="up">
          <h2 class="section-title inline-block">四步快速上手</h2>
          <p class="section-sub">从入驻到使用，全程引导，无需技术背景。</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          <div
            v-for="(s, i) in steps"
            :key="i"
            class="reveal-cell"
            :data-reveal="i % 2 ? 'right' : 'left'"
            :style="`transition-delay: ${i * 0.12}s`"
          >
            <div class="step-card" data-tilt>
              <div class="step-num">{{ s.n }}</div>
              <h3 class="step-title">{{ s.title }}</h3>
              <p class="step-desc">{{ s.desc }}</p>
              <div v-if="i < steps.length - 1" class="step-arrow"><MorphIcon name="arrow-right" :size="22" /></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ 架构 ============ -->
    <section class="section section-alt">
      <div class="container">
        <div class="text-center mb-14" data-reveal="up">
          <h2 class="section-title inline-block">清晰的多级权限架构</h2>
          <p class="section-sub">每一级管理员只能管理自己的下级，保证数据安全和管理规范。</p>
        </div>

        <div class="arch-tree">
          <div
            v-for="(node, i) in [
              { icon: 'crown', title: '超级管理员', desc: '管理所有学校，审核入驻申请，系统全局配置', tag: '总系统', cls: 'arch-red' },
              { icon: 'school', title: '学校管理员', desc: '管理本校年级，配置学校信息，管理年级管理员账号', tag: '学校', cls: 'arch-blue' },
              { icon: 'book-open', title: '年级管理员', desc: '管理本年级班级，创建班级，管理班级管理员账号', tag: '年级', cls: 'arch-green' },
              { icon: 'user-cog', title: '班级管理员（班主任）', desc: '管理本班学生，日常积分操作、座位编排、数据统计', tag: '班级', cls: 'arch-cyan' },
            ]"
            :key="i"
            class="arch-node"
            :class="node.cls"
            data-reveal="left"
            :style="`transition-delay: ${i * 0.1}s`"
          >
            <div class="arch-icon"><MorphIcon :name="node.icon" :size="30" /></div>
            <div class="flex-1">
              <h3 class="arch-title">{{ node.title }}</h3>
              <p class="arch-desc">{{ node.desc }}</p>
            </div>
            <div class="arch-tag">{{ node.tag }}</div>
            <div v-if="i < 3" class="arch-link"></div>
          </div>
        </div>
      </div>
    </section>

        </div>
      </div>
    </div>

    <!-- ============ FAQ ============ -->
    <section class="section">
      <div class="container container-narrow">
        <div class="text-center mb-14" data-reveal="up">
          <h2 class="section-title inline-block">常见问题</h2>
        </div>

        <div class="space-y-3">
          <div
            v-for="(item, i) in faqs"
            :key="i"
            class="faq-card"
            data-reveal="up"
            :style="`transition-delay: ${i * 0.08}s`"
          >
            <button class="faq-q" @click="toggleFaq(i)">
              <span>{{ item.q }}</span>
              <span class="faq-chevron" :class="{ open: openFaq === i }">▼</span>
            </button>
            <div v-if="openFaq === i" class="faq-a">{{ item.a }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ CTA ============ -->
    <section class="section cta-section">
      <div class="cta-glow"></div>
      <div class="container text-center" data-reveal="scale">
        <h2 class="cta-title">准备好提升班级管理效率了吗？</h2>
        <p class="cta-sub">联系超级管理员获取入驻资格，开启智能化班级管理新时代。</p>
        <div class="hero-cta">
          <NuxtLink to="/apply" class="btn-neon" data-magnetic>立即申请入驻</NuxtLink>
          <NuxtLink to="/login" class="btn-ghost-neon" data-magnetic>已有账号？登录</NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* ============ 基础（宇宙科技 · 深空蓝黑，纯色无渐变） ============ */
.cosmic-page {
  position: relative;
  min-height: 100vh;
  background: #070b14;
  color: #dbe4f0;
  --scroll: 0;
}

.container {
  max-width: 80rem;
  margin: 0 auto;
  padding: 0 1.5rem;
}
@media (min-width: 640px) { .container { padding: 0 2rem; } }
@media (min-width: 1024px) { .container { padding: 0 3rem; } }
.container-narrow { max-width: 48rem; }

.section {
  position: relative;
  z-index: 2;
  padding: 5rem 0;
  border-top: 1px solid rgba(110, 140, 180, 0.1);
}
.section-alt { background: rgba(13, 20, 36, 0.5); }

/* ============ 全局固定星海 + 星尘 + 进度条 ============ */
.starfield {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}
.stardust-layer {
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  overflow: hidden;
}
.stardust-dot {
  position: absolute;
  border-radius: 50%;
  background: #cddff2;
  box-shadow: 0 0 8px #a8c4e0;
  opacity: 0;
  animation-name: floatUp;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}
@keyframes floatUp {
  0% { transform: translateY(0); opacity: 0; }
  8% { opacity: 0.85; }
  60% { opacity: 0.45; }
  100% { transform: translateY(-42vh); opacity: 0; }
}
.scroll-progress {
  position: fixed;
  top: 0;
  left: 0;
  height: 3px;
  width: 0;
  background: #4a7ab5;
  box-shadow: 0 0 10px rgba(74, 122, 181, 0.7), 0 0 20px rgba(74, 122, 181, 0.4);
  z-index: 100;
  pointer-events: none;
}

/* ============ HERO ============ */
.hero {
  position: relative;
  z-index: 2;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  --mx: 0;
  --my: 0;
}
.bg-field {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  transform: translateY(calc(var(--scroll) * -70px));
}
.nebula {
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);
  opacity: 0.4;
  animation: drift 22s ease-in-out infinite alternate;
}
.nebula-1 { top: -8%; left: -6%; width: 38rem; height: 38rem; background: #3a6396; }
.nebula-2 { bottom: -12%; right: -8%; width: 44rem; height: 44rem; background: #31537e; animation-delay: -7s; }
.nebula-3 { top: 30%; right: 20%; width: 26rem; height: 26rem; background: #4a7ab5; animation-delay: -14s; }
@keyframes drift {
  from { transform: translate3d(0, 0, 0) scale(1); }
  to   { transform: translate3d(40px, -30px, 0) scale(1.1); }
}

.grid-floor {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 38%;
  opacity: 0.3;
  background-image: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='60'%20height='60'%3E%3Cpath%20d='M60%200%20L0%200%20L0%2060'%20fill='none'%20stroke='%235b7ba3'%20stroke-opacity='0.22'%20stroke-width='1'/%3E%3C/svg%3E");
  transform: perspective(420px) rotateX(62deg);
  transform-origin: bottom center;
}

.aurora {
  position: absolute;
  z-index: 0;
  height: 140px;
  width: 55%;
  filter: blur(60px);
  opacity: 0.35;
  mix-blend-mode: screen;
  pointer-events: none;
}
.aurora-1 { top: 10%; left: -15%; background: #4a7ab5; animation: auroraSweep 13s ease-in-out infinite alternate; }
.aurora-2 { bottom: 12%; right: -18%; background: #31537e; animation: auroraSweep 17s ease-in-out infinite alternate-reverse; }
@keyframes auroraSweep {
  from { transform: translateX(-12%) scale(1); }
  to   { transform: translateX(60%) scale(1.25); }
}

.cursor-glow {
  position: absolute;
  top: 0;
  left: 0;
  width: 420px;
  height: 420px;
  margin: -210px 0 0 -210px;
  border-radius: 50%;
  background: rgba(90, 130, 180, 0.16);
  filter: blur(20px);
  z-index: 1;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.4s ease;
  mix-blend-mode: screen;
  will-change: transform;
}
.ripple {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid #6b95c6;
  box-shadow: 0 0 10px rgba(107, 149, 198, 0.7);
  transform: translate(-50%, -50%) scale(0);
  animation: ripple 0.7s ease-out forwards;
  pointer-events: none;
  z-index: 3;
}
@keyframes ripple {
  to { transform: translate(-50%, -50%) scale(14); opacity: 0; }
}

.hero-content {
  position: relative;
  z-index: 2;
  text-align: center;
  max-width: 64rem;
  padding: 6rem 1.5rem 4rem;
  transform: translate(calc(var(--mx) * -18px), calc(var(--my) * -12px));
  transition: transform 0.25s ease-out;
}

.badge-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 9999px;
  font-size: 0.8rem;
  color: #a9c2e2;
  background: rgba(74, 122, 181, 0.12);
  border: 1px solid rgba(107, 149, 198, 0.32);
  box-shadow: 0 0 20px rgba(74, 122, 181, 0.16);
  margin-bottom: 2rem;
}
.badge-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: #6b95c6;
  box-shadow: 0 0 8px rgba(107, 149, 198, 0.8);
  animation: pulse-dot 1.6s ease-in-out infinite;
}
@keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

.hero-title {
  font-size: clamp(2.4rem, 6vw, 4.2rem);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.02em;
  margin-bottom: 1.5rem;
  color: #eaf1f9;
  text-shadow: 0 0 36px rgba(74, 122, 181, 0.2);
  min-height: 2.2em;
}
.accent-text {
  display: inline-block;
  color: #9db8de;
  text-shadow:
    0 0 8px rgba(107, 149, 198, 0.65),
    0 0 20px rgba(74, 122, 181, 0.4),
    0 0 40px rgba(74, 122, 181, 0.25);
  animation: glitchFlicker 4s infinite steps(1);
}
@keyframes glitchFlicker {
  0%, 88%, 100% { opacity: 1; }
  90% { opacity: 0.7; }
  92% { opacity: 1; }
  94% { opacity: 0.8; text-shadow: 2px 0 #6b95c6, -2px 0 #8b99b0; }
  96% { opacity: 1; text-shadow: 0 0 8px rgba(107,149,198,0.65), 0 0 20px rgba(74,122,181,0.4); }
}
.hero-sub {
  font-size: 1.1rem;
  color: #8b99b0;
  line-height: 1.7;
  max-width: 42rem;
  margin: 0 auto 2.5rem;
}
.hero-cta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.btn-neon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.85rem 2rem;
  font-weight: 700;
  font-size: 1rem;
  border-radius: 0.75rem;
  color: #f2f6fb;
  background: #4a7ab5;
  box-shadow: 0 0 20px rgba(74, 122, 181, 0.45), inset 0 0 0 1px rgba(255, 255, 255, 0.12);
  border: none;
  cursor: pointer;
  transition: box-shadow 0.2s ease, background 0.2s ease, transform 0.2s ease;
  text-decoration: none;
  will-change: transform;
}
.btn-neon:hover {
  background: #3a6396;
  box-shadow: 0 0 32px rgba(107, 149, 198, 0.55), inset 0 0 0 1px rgba(255, 255, 255, 0.2);
}
.btn-ghost-neon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.85rem 2rem;
  font-weight: 600;
  font-size: 1rem;
  border-radius: 0.75rem;
  color: #c2cfe0;
  background: rgba(10, 16, 28, 0.5);
  border: 1px solid rgba(107, 149, 198, 0.3);
  cursor: pointer;
  transition: box-shadow 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
  text-decoration: none;
  will-change: transform;
}
.btn-ghost-neon:hover {
  color: #fff;
  border-color: rgba(107, 149, 198, 0.55);
  box-shadow: 0 0 18px rgba(74, 122, 181, 0.25);
}
.gh-icon {
  width: 1.1rem;
  height: 1.1rem;
  flex-shrink: 0;
  margin-right: 0.5rem;
}

/* 星轨装置 */
.orbit-wrap {
  position: relative;
  width: 320px;
  height: 320px;
  margin: 4rem auto 0;
  transform: translate(calc(var(--mx) * 26px), calc(var(--my) * 18px));
  transition: transform 0.3s ease-out;
}
.orbit-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1px solid rgba(107, 149, 198, 0.22);
  box-shadow: 0 0 26px rgba(74, 122, 181, 0.1) inset;
}
.ring-1 { animation: spin 18s linear infinite; border-color: rgba(107, 149, 198, 0.3); }
.ring-2 { inset: 38px; animation: spin 13s linear infinite reverse; border-color: rgba(74, 122, 181, 0.3); border-style: dashed; }
.ring-3 { inset: 76px; animation: spin 9s linear infinite; border-color: rgba(147, 179, 214, 0.26); }
@keyframes spin { to { transform: rotate(360deg); } }
.sat {
  position: absolute;
  top: -5px;
  left: 50%;
  width: 10px;
  height: 10px;
  margin-left: -5px;
  border-radius: 50%;
}
.sat-a { background: #6b95c6; box-shadow: 0 0 10px rgba(107, 149, 198, 0.8); }
.sat-b { background: #93b3d6; box-shadow: 0 0 10px rgba(147, 179, 214, 0.8); }

.planet {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 84px;
  height: 84px;
  margin: -42px 0 0 -42px;
  border-radius: 50%;
  background: #1f3550;
  box-shadow:
    inset -10px -10px 24px rgba(0, 0, 0, 0.55),
    inset 8px 8px 20px rgba(157, 184, 222, 0.3),
    0 0 36px rgba(74, 122, 181, 0.5);
  animation: planetFloat 5s ease-in-out infinite;
}
@keyframes planetFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
.glass-console {
  position: absolute;
  bottom: -36px;
  left: 50%;
  transform: translateX(-50%);
  width: 260px;
  background: rgba(10, 14, 28, 0.8);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(107, 149, 198, 0.28);
  border-radius: 0.9rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5), 0 0 26px rgba(74, 122, 181, 0.18);
  overflow: hidden;
  text-align: left;
}
.console-bar {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.75rem;
  background: rgba(74, 122, 181, 0.1);
  border-bottom: 1px solid rgba(107, 149, 198, 0.15);
}
.dot { width: 0.55rem; height: 0.55rem; border-radius: 50%; }
.dot.r { background: #c0564a; }
.dot.y { background: #b89a4a; }
.dot.g { background: #3f9d86; }
.console-path { margin-left: 0.5rem; font-size: 0.7rem; color: #6b95c6; font-family: ui-monospace, monospace; }
.console-body { padding: 0.9rem; display: flex; flex-direction: column; gap: 0.5rem; }
.console-line { height: 0.55rem; border-radius: 0.3rem; background: rgba(107, 149, 198, 0.16); }
.console-line.w-1-3 { width: 33%; }
.console-line.w-full { width: 100%; }
.console-line.w-5-6 { width: 83%; }
.console-line.w-2-3 { width: 66%; }
.console-chips { display: flex; gap: 0.4rem; margin-top: 0.3rem; }
.chip { width: 1.6rem; height: 0.6rem; border-radius: 9999px; }
.chip-1 { background: #6b95c6; box-shadow: 0 0 8px rgba(107, 149, 198, 0.8); }
.chip-2 { background: #54708f; box-shadow: 0 0 8px rgba(84, 112, 143, 0.8); }
.chip-3 { background: #8b99b0; box-shadow: 0 0 8px rgba(139, 153, 176, 0.8); }

.scroll-indicator {
  position: absolute;
  bottom: 1.8rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  color: #64748b;
  font-size: 0.75rem;
  letter-spacing: 0.15em;
}
.mouse {
  width: 24px;
  height: 38px;
  border: 1.5px solid rgba(107, 149, 198, 0.5);
  border-radius: 14px;
  display: flex;
  justify-content: center;
  padding-top: 6px;
}
.wheel {
  width: 3px;
  height: 7px;
  border-radius: 2px;
  background: #6b95c6;
  animation: wheel 1.6s ease-in-out infinite;
}
@keyframes wheel {
  0% { opacity: 0; transform: translateY(-4px); }
  40% { opacity: 1; }
  100% { opacity: 0; transform: translateY(8px); }
}

/* ============ 区块标题 ============ */
.section-title {
  font-size: clamp(1.6rem, 3.5vw, 2.2rem);
  font-weight: 800;
  color: #eaf1f9;
  margin-bottom: 0.75rem;
  text-shadow: 0 0 20px rgba(74, 122, 181, 0.18);
}
.title-mark { color: #6b95c6; margin-right: 0.5rem; text-shadow: 0 0 10px rgba(107, 149, 198, 0.6); }
.section-sub { color: #8b99b0; max-width: 40rem; margin: 0 auto; font-size: 0.95rem; }

/* ============ HUD 公告面板 ============ */
.hud-panel {
  position: relative;
  padding: 1rem 1.25rem;
  border-radius: 0.85rem;
  border: 1px solid rgba(107, 149, 198, 0.24);
  background: rgba(15, 22, 38, 0.7);
  box-shadow: 0 0 20px rgba(74, 122, 181, 0.1);
  overflow: hidden;
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}
.hud-panel:hover { transform: translateY(-2px); box-shadow: 0 0 28px rgba(74, 122, 181, 0.22); }
.hud-corner {
  position: absolute;
  top: 0; left: 0;
  width: 14px; height: 14px;
  border-top: 2px solid #6b95c6;
  border-left: 2px solid #6b95c6;
  opacity: 0.7;
}
.cosmic-info { border-color: rgba(74, 122, 181, 0.4); }
.cosmic-warn { border-color: rgba(201, 162, 39, 0.4); box-shadow: 0 0 20px rgba(201, 162, 39, 0.12); }
.cosmic-danger { border-color: rgba(192, 57, 43, 0.45); box-shadow: 0 0 20px rgba(192, 57, 43, 0.14); }
.hud-title { font-size: 0.9rem; font-weight: 700; color: #eaf1f9; margin-bottom: 0.25rem; }

/* ============ 揭示单元 + 霓虹卡片 ============ */
.reveal-cell { height: 100%; }
.neon-card {
  position: relative;
  height: 100%;
  padding: 1.75rem;
  border-radius: 1rem;
  background: rgba(15, 22, 38, 0.65);
  border: 1px solid rgba(107, 149, 198, 0.2);
  overflow: hidden;
  transition: transform 0.15s ease-out, box-shadow 0.3s ease, border-color 0.3s ease;
  will-change: transform;
}
.neon-card:hover {
  border-color: rgba(107, 149, 198, 0.5);
  box-shadow: 0 12px 40px rgba(74, 122, 181, 0.16), 0 0 20px rgba(74, 122, 181, 0.18);
}
.neon-card-icon {
  width: 3rem;
  height: 3rem;
  border-radius: 0.85rem;
  background: rgba(74, 122, 181, 0.12);
  border: 1px solid rgba(107, 149, 198, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  margin-bottom: 1rem;
  box-shadow: 0 0 16px rgba(74, 122, 181, 0.14);
}
.neon-card-title { font-size: 1.05rem; font-weight: 700; color: #eaf1f9; margin-bottom: 0.5rem; }
.neon-card-desc { font-size: 0.875rem; color: #8b99b0; line-height: 1.7; }
.scan-line {
  position: absolute;
  left: 0; bottom: 0;
  height: 2px;
  width: 100%;
  background: #6b95c6;
  opacity: 0.8;
  transform: translateX(-100%);
  transition: transform 0.6s ease;
}
.neon-card:hover .scan-line { transform: translateX(100%); }

/* ============ 流程卡片 ============ */
.step-card {
  position: relative;
  height: 100%;
  padding: 1.75rem;
  border-radius: 1rem;
  text-align: center;
  background: rgba(15, 22, 38, 0.6);
  border: 1px solid rgba(107, 149, 198, 0.18);
  transition: transform 0.15s ease-out, box-shadow 0.3s ease;
  will-change: transform;
}
.step-card:hover { box-shadow: 0 0 24px rgba(74, 122, 181, 0.16); }
.step-num {
  font-size: 2.6rem;
  font-weight: 800;
  color: transparent;
  -webkit-text-stroke: 1.5px rgba(107, 149, 198, 0.7);
  margin-bottom: 0.75rem;
  text-shadow: 0 0 16px rgba(107, 149, 198, 0.25);
}
.step-title { font-size: 1rem; font-weight: 700; color: #eaf1f9; margin-bottom: 0.5rem; }
.step-desc { font-size: 0.85rem; color: #8b99b0; line-height: 1.6; }
.step-arrow {
  position: absolute;
  top: 50%;
  right: -1.2rem;
  transform: translateY(-50%);
  color: #6b95c6;
  font-size: 1.4rem;
  opacity: 0.6;
}
@media (max-width: 1023px) { .step-arrow { display: none; } }

/* ============ 架构星链 ============ */
.arch-tree { max-width: 56rem; margin: 0 auto; }
.arch-node {
  position: relative;
  display: flex;
  align-items: center;
  gap: 1.25rem;
  padding: 1.25rem 1.5rem;
  margin-bottom: 1rem;
  border-radius: 1rem;
  background: rgba(15, 22, 38, 0.65);
  border: 1px solid rgba(107, 149, 198, 0.22);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}
.arch-node:hover { transform: translateX(6px); }
.arch-red:hover { box-shadow: 0 0 26px rgba(192, 86, 74, 0.18); }
.arch-blue:hover { box-shadow: 0 0 26px rgba(74, 122, 181, 0.2); }
.arch-green:hover { box-shadow: 0 0 26px rgba(63, 157, 134, 0.18); }
.arch-cyan:hover { box-shadow: 0 0 26px rgba(107, 149, 198, 0.2); }
.arch-icon {
  width: 3rem;
  height: 3rem;
  flex-shrink: 0;
  border-radius: 0.85rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  background: rgba(74, 122, 181, 0.12);
  border: 1px solid rgba(107, 149, 198, 0.25);
}
.arch-red .arch-icon { background: rgba(192, 86, 74, 0.12); border-color: rgba(192, 86, 74, 0.3); }
.arch-blue .arch-icon { background: rgba(74, 122, 181, 0.12); border-color: rgba(74, 122, 181, 0.3); }
.arch-green .arch-icon { background: rgba(63, 157, 134, 0.12); border-color: rgba(63, 157, 134, 0.3); }
.arch-cyan .arch-icon { background: rgba(107, 149, 198, 0.12); border-color: rgba(107, 149, 198, 0.3); }
.arch-title { font-size: 1rem; font-weight: 700; color: #eaf1f9; }
.arch-desc { font-size: 0.85rem; color: #8b99b0; line-height: 1.5; }
.arch-tag {
  flex-shrink: 0;
  font-size: 0.7rem;
  padding: 0.25rem 0.6rem;
  border-radius: 9999px;
  color: #c2cfe0;
  background: rgba(74, 122, 181, 0.12);
  border: 1px solid rgba(107, 149, 198, 0.25);
}
.arch-link {
  position: absolute;
  left: 2.5rem;
  bottom: -1rem;
  width: 2px;
  height: 1rem;
  background: rgba(107, 149, 198, 0.4);
}

/* ============ FAQ ============ */
.faq-card {
  border-radius: 0.85rem;
  overflow: hidden;
  background: rgba(15, 22, 38, 0.6);
  border: 1px solid rgba(107, 149, 198, 0.18);
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}
.faq-card:hover { border-color: rgba(107, 149, 198, 0.4); box-shadow: 0 0 20px rgba(74, 122, 181, 0.12); }
.faq-q {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.1rem 1.25rem;
  background: transparent;
  border: none;
  color: #dbe4f0;
  font-size: 0.9rem;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}
.faq-chevron { color: #6b95c6; font-size: 0.8rem; transition: transform 0.3s ease; }
.faq-chevron.open { transform: rotate(180deg); }
.faq-a {
  padding: 0 1.25rem 1.1rem;
  font-size: 0.85rem;
  color: #8b99b0;
  line-height: 1.7;
  animation: fadeIn 0.35s ease-out;
}

/* ============ CTA ============ */
.cta-section { position: relative; text-align: center; overflow: hidden; }
.cta-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 600px;
  height: 600px;
  transform: translate(-50%, -50%);
  background: rgba(74, 122, 181, 0.16);
  filter: blur(40px);
  pointer-events: none;
}
.cta-title {
  position: relative;
  font-size: clamp(1.6rem, 4vw, 2.4rem);
  font-weight: 800;
  color: #eaf1f9;
  margin-bottom: 1rem;
  text-shadow: 0 0 28px rgba(74, 122, 181, 0.25);
}
.cta-sub { position: relative; color: #8b99b0; max-width: 36rem; margin: 0 auto 2rem; }

/* ============ 横向滚动区（宽屏启用；小屏自动回退为纵向布局） ============ */
/* sticky + transform 平移方案：外层 .h-scroll 由 JS 撑开占位高度，内层 .h-sticky
   钉在视口，竖向滚动时把容器 top 映射成 .h-track 的 translateX，实现"下滚横移" */
.h-track { display: block; }
.h-scroll--active .h-sticky {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow: hidden;
}
.h-scroll--active .h-track {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  height: 100vh;
  width: max-content;
  will-change: transform;
}
.h-scroll--active .h-track > section {
  flex: 0 0 100vw;
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 3rem 0;
  overflow-y: auto;
  border-top: none;
}
.h-scroll--active .h-track > section.section-alt {
  background: transparent;
}
/* 横向滚动区内：揭示动画改由 .in 类驱动（按屏序列渐显 + 退回淡出）
   保留各方向位移（up/left/right/scale），进入激活屏时 .in 归位，离开时退回隐藏态 */
.h-scroll--active .h-track [data-reveal] {
  opacity: 0;
  transition: opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1),
              transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}
.h-scroll--active .h-track [data-reveal].in {
  opacity: 1;
  transform: none;
}

/* ============ 滚动揭示（多方向变体） ============ */
[data-reveal] {
  opacity: 0;
  transition: opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1), transform 0.7s cubic-bezier(0.22, 1, 0.36, 1);
}
[data-reveal='up'] { transform: translateY(34px); }
[data-reveal='left'] { transform: translateX(-40px); }
[data-reveal='right'] { transform: translateX(40px); }
[data-reveal='scale'] { transform: scale(0.9); }
[data-reveal].is-visible { opacity: 1; transform: none; }

/* ============ 动画 ============ */
.animate-fade-in { animation: fadeIn 0.5s ease-out both; }
.animate-slide-up { animation: slideUp 0.7s ease-out both; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slideUp { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: translateY(0); } }
.pulse { animation: pulse 1.6s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.9; } }

/* ============ 公告 HTML 内容 ============ */
.announcement-content :deep(a) { color: #6b95c6; text-decoration: underline; text-underline-offset: 2px; opacity: 0.9; }
.announcement-content :deep(a:hover) { opacity: 1; }
.announcement-content :deep(b),
.announcement-content :deep(strong) { font-weight: 700; color: #dbe4f0; }
.announcement-content :deep(i),
.announcement-content :deep(em) { font-style: italic; }
.announcement-content :deep(u) { text-decoration: underline; }
.announcement-content :deep(br) { content: ''; display: block; margin: 0.25rem 0; }
.announcement-content :deep(p) { margin: 0.5rem 0; }
.announcement-content :deep(p:first-child) { margin-top: 0; }
.announcement-content :deep(p:last-child) { margin-bottom: 0; }
.announcement-content :deep(ul),
.announcement-content :deep(ol) { margin: 0.5rem 0; padding-left: 1.5rem; }
.announcement-content :deep(li) { margin: 0.25rem 0; }
.announcement-content :deep(code) {
  background: rgba(30, 41, 59, 0.5);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.875em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.announcement-content :deep(hr) { border: none; border-top: 1px solid rgba(71, 85, 105, 0.3); margin: 0.75rem 0; }
.announcement-content :deep(h1),
.announcement-content :deep(h2),
.announcement-content :deep(h3),
.announcement-content :deep(h4),
.announcement-content :deep(h5),
.announcement-content :deep(h6) { font-weight: 700; color: #dbe4f0; margin: 0.5rem 0; }
.announcement-content :deep(h1) { font-size: 1.25rem; }
.announcement-content :deep(h2) { font-size: 1.125rem; }
.announcement-content :deep(h3) { font-size: 1rem; }
.announcement-content :deep(h4) { font-size: 0.95rem; }
.announcement-content :deep(h5) { font-size: 0.9rem; }
.announcement-content :deep(h6) { font-size: 0.85rem; }
.announcement-content :deep(blockquote) {
  border-left: 3px solid rgba(107, 149, 198, 0.4);
  padding-left: 0.75rem;
  margin: 0.5rem 0;
  color: #8b99b0;
  font-style: italic;
}

@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
  [data-reveal] { opacity: 1; transform: none; }
}
</style>
