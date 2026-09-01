<script setup lang="ts">
import type { NuxtError } from '#app'
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'

const props = defineProps<{ error: NuxtError }>()

const code = computed(() => props.error?.statusCode || 500)
const is404 = computed(() => code.value === 404)

const title = computed(() =>
  is404.value ? '页面走丢了' : '系统开小差了'
)
const desc = computed(() =>
  is404.value
    ? '你访问的页面不存在，或已经被移动到了别处。检查一下网址，或者直接返回首页继续探索。'
    : '抱歉，系统在处理你的请求时出现了意外。你可以返回上一页重试，或回到首页。'
)

useHead({
  title: computed(() => `${code.value} · ${title.value} | CSMS`),
})

function goHome() {
  clearError({ redirect: '/' })
}
function goBack() {
  clearError()
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

/* 星海（纯色实心 + 辉光 + 鼠标视差），与主页一致；保持轻量，错误页须稳健 */
const reduceMotion = ref(false)
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
  const count = Math.min(200, Math.floor((w * hgt) / 6000))
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
  if (Math.random() < 0.01 && shooting.length < 2) {
    shooting.push({
      x: Math.random() * w * 0.7,
      y: Math.random() * hgt * 0.4,
      len: Math.random() * 120 + 70,
      speed: Math.random() * 6 + 6,
      angle: Math.PI / 4 + (Math.random() - 0.5) * 0.3,
    })
  }
}
function draw() {
  if (!ctx) return
  ctx.clearRect(0, 0, w, hgt)
  ctx.shadowBlur = 6
  ctx.shadowColor = 'rgba(150,180,215,0.7)'
  for (const s of stars) {
    s.y += s.z * 0.14
    if (s.y > hgt) { s.y = 0; s.x = Math.random() * w }
    s.tw += s.tws
    const px = s.x - gmx * s.z * 16
    const py = s.y - gmy * s.z * 12
    const alpha = Math.max(0.15, 0.42 + Math.sin(s.tw) * 0.32 + s.z * 0.2)
    ctx.beginPath()
    ctx.arc(px, py, s.r * s.z, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(205,224,245,${alpha.toFixed(3)})`
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
    ctx.strokeStyle = 'rgba(170,205,240,0.85)'
    ctx.shadowBlur = 8
    ctx.shadowColor = 'rgba(170,205,240,0.8)'
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
  canvas = document.getElementById('err-starfield') as HTMLCanvasElement
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
  window.addEventListener('mousemove', onGlobalMouse, { passive: true })
}

onMounted(() => {
  if (import.meta.client) startStarfield()
})
onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
  window.removeEventListener('resize', resizeCanvas)
  window.removeEventListener('mousemove', onGlobalMouse)
})
</script>

<template>
  <div class="err-page">
    <AppNavbar />

    <canvas id="err-starfield" class="err-starfield"></canvas>
    <div class="err-stardust" aria-hidden="true">
      <span
        v-for="(d, i) in stardust"
        :key="i"
        class="err-dot"
        :style="{ left: d.left, top: d.top, width: d.size + 'px', height: d.size + 'px', animationDelay: d.delay, animationDuration: d.dur }"
      ></span>
    </div>

    <main class="err-main">
      <div class="err-glow"></div>
      <div class="err-inner">
        <div class="err-badge">
          <span class="err-badge-dot"></span>
          {{ is404 ? '404 · 页面未找到' : code + ' · 系统错误' }}
        </div>

        <h1 class="err-code">{{ code }}</h1>

        <h2 class="err-title">{{ title }}</h2>
        <p class="err-desc">{{ desc }}</p>

        <div class="err-actions">
          <button class="btn-neon" data-magnetic @click="goHome">返回首页</button>
          <button class="btn-ghost-neon" data-magnetic @click="goBack">返回上一页</button>
        </div>
      </div>
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
/* ============ 基础（宇宙科技 · 深空蓝黑，纯色无渐变，与主页一致） ============ */
/* error.vue 由 nuxt-root 在根级渲染（不经 default 布局），故自带导航栏/页脚以贴合主页 */
.err-page {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #070b14;
  color: #dbe4f0;
  overflow: hidden;
}

.err-starfield {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}
.err-stardust {
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  overflow: hidden;
}
.err-dot {
  position: absolute;
  border-radius: 50%;
  background: #cddff2;
  box-shadow: 0 0 8px #a8c4e0;
  opacity: 0;
  animation-name: errFloat;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}
@keyframes errFloat {
  0% { transform: translateY(0); opacity: 0; }
  8% { opacity: 0.85; }
  60% { opacity: 0.45; }
  100% { transform: translateY(-42vh); opacity: 0; }
}

.err-main {
  position: relative;
  z-index: 2;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 5rem 1.5rem 4rem;
}

/* 中央辉光（纯色 + blur，禁止渐变） */
.err-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 540px;
  height: 540px;
  max-width: 90vw;
  transform: translate(-50%, -50%);
  background: rgba(74, 122, 181, 0.16);
  filter: blur(60px);
  pointer-events: none;
  z-index: -1;
}

.err-inner {
  position: relative;
  z-index: 2;
  max-width: 40rem;
  text-align: center;
}

.err-badge {
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
  margin-bottom: 1.5rem;
}
.err-badge-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: #6b95c6;
  box-shadow: 0 0 8px rgba(107, 149, 198, 0.8);
  animation: errPulse 1.6s ease-in-out infinite;
}
@keyframes errPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

.err-code {
  font-size: clamp(6rem, 22vw, 13rem);
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.04em;
  margin: 0 0 0.5rem;
  color: #9db8de;
  text-shadow:
    0 0 10px rgba(107, 149, 198, 0.65),
    0 0 30px rgba(74, 122, 181, 0.45),
    0 0 60px rgba(74, 122, 181, 0.28);
  animation: errFlicker 4s infinite steps(1);
}
@keyframes errFlicker {
  0%, 88%, 100% { opacity: 1; }
  90% { opacity: 0.7; }
  92% { opacity: 1; }
  94% { opacity: 0.8; text-shadow: 2px 0 #6b95c6, -2px 0 #8b99b0; }
  96% { opacity: 1; text-shadow: 0 0 10px rgba(107,149,198,0.65), 0 0 30px rgba(74,122,181,0.45); }
}

.err-title {
  font-size: clamp(1.5rem, 3.5vw, 2.1rem);
  font-weight: 800;
  color: #eaf1f9;
  margin-bottom: 0.75rem;
  text-shadow: 0 0 20px rgba(74, 122, 181, 0.18);
}
.err-desc {
  font-size: 1.02rem;
  color: #8b99b0;
  line-height: 1.7;
  max-width: 34rem;
  margin: 0 auto 2.5rem;
}

.err-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
}

/* ============ 按钮（与主页 .btn-neon / .btn-ghost-neon 一致） ============ */
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
}
.btn-ghost-neon:hover {
  color: #fff;
  border-color: rgba(107, 149, 198, 0.55);
  box-shadow: 0 0 18px rgba(74, 122, 181, 0.25);
}

@media (prefers-reduced-motion: reduce) {
  .err-dot, .err-code, .err-badge-dot { animation: none !important; }
  .err-code { opacity: 1; }
}
</style>
