import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  // 生产环境关闭 devtools
  devtools: { enabled: process.env.NODE_ENV !== 'production' },

  modules: ['@nuxtjs/color-mode', 'nuxt-auth-utils', '@vite-pwa/nuxt'],

  // ============ PWA ============
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'CSMS - 班级积分管理系统',
      short_name: 'CSMS',
      description: '基于 Nuxt 4 的多级班级积分管理系统',
      lang: 'zh-CN',
      theme_color: '#070b14',
      background_color: '#070b14',
      display: 'standalone',
      start_url: '/',
      scope: '/',
      icons: [
        { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: '/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      // 预缓存构建产物（JS/CSS/字体/图标）
      globPatterns: ['**/*.{js,css,html,png,svg,ico,woff,woff2}'],
      // SSR 应用，禁用 navigateFallback 避免拦截导航
      navigateFallback: null,
      cleanupOutdatedCaches: true,
      // 运行时缓存：API 永不缓存，静态资源走 CacheFirst
      runtimeCaching: [
        {
          urlPattern: /\/api\/.*/,
          handler: 'NetworkOnly',
          options: { cacheName: 'csms-no-cache' },
        },
        {
          urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|woff2?|ttf|otf)$/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'csms-static',
            expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
      ],
    },
    devOptions: {
      // 开发模式关闭 PWA，避免 HMR 与 SW 互相干扰
      enabled: false,
    },
    client: {
      installPrompt: true,
      // 开发模式下不注入 Service Worker 客户端插件（生产构建照常注入）。
      // 该插件会无条件执行 navigator.serviceWorker.register('/sw.js')，
      // 而 dev 下 sw.js 并不存在（devOptions.enabled: false）→ 请求落到 SSR 渲染 →
      // Vue Router 报 "No match found for location with path /sw.js" 并触发 404。
      // 关闭后 $pwa 不存在，PwaPrompt.vue 已有完整 fallback，两个弹窗均不渲染，无副作用。
      registerPlugin: process.env.NODE_ENV === 'production',
    },
  },

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: [
        '@vue/devtools-core',
        '@vue/devtools-kit',
      ],
    },
  },

  // 开发服务器配置（支持 IPv6）
  devServer: {
    host: '::',  // 监听 IPv6 (同时支持 IPv4)
    port: 3000
  },

  colorMode: {
    preference: 'dark',  // 默认深色模式
    fallback: 'dark',
    classSuffix: '',
    storageKey: 'csms-theme',
  },

  auth: {
    webAuthn: false,
  },

  future: {
    compatibilityVersion: 4,
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    // ============ nuxt-auth-utils session ============
    // 【安全】会话加密密钥不再提供任何硬编码兜底：
    //  - 生产环境必须通过环境变量注入会话密钥；
    //    运行时读取顺序（见 server/plugins/00.security-guard.ts）：
    //      NUXT_SESSION_PASSWORD（运行时实时读取，推荐，适用于任何部署 / 预构建产物）
    //      → 本构建期值（由 process.env.SESSION_SECRET 在 npm run build 前注入，已烘焙进产物）
    //    缺失/过短时由 00.security-guard.ts 在启动阶段直接终止进程；
    //  - 开发环境由 nuxt-auth-utils 自动生成随机密钥并写入 .env(NUXT_SESSION_PASSWORD)。
    // 说明：NUXT_SESSION_PASSWORD 在运行时实时生效，预构建产物（如下载包）也必须用它；
    //       SESSION_SECRET 仅在「build 之前」设置才被烘焙进产物，运行期修改无效。
    session: {
      password: process.env.NUXT_SESSION_PASSWORD || process.env.SESSION_SECRET || '',
      name: 'csms-session',
      // 会话 Cookie 安全标志（显式声明，不依赖框架默认值）
      cookie: {
        httpOnly: true,                                  // 禁止前端 JS 读取，缓解 XSS 窃取会话
        secure: process.env.NODE_ENV === 'production',    // 生产强制仅 HTTPS 传输
        sameSite: 'lax',                                  // 缓解 CSRF（跨站 POST 不携带）
        path: '/',
      },
      // 会话有效期 7 天：同时作为 Cookie expires 与密封票据 TTL，到期强制重新登录
      maxAge: 60 * 60 * 24 * 7,
    },
    // Public keys (exposed to client)
    public: {
      apiBase: '/api',
    },
  },

  nitro: {
    // 生产环境 preset: node-server (支持 SQLite)
    preset: process.env.NODE_ENV === 'production' ? 'node-server' : undefined,

    experimental: {
      database: true,
    },

    // 开启压缩
    compressPublicAssets: {
      brotli: true,
    },
  },

  // SSR 开启（管理系统需要 SEO 不重要，但首屏加载更快）
  ssr: true,

  // 性能优化
  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=500, initial-scale=1',
      title: 'CSMS - 班级积分管理系统',
      meta: [
        { name: 'description', content: '班级积分管理系统 v0.3.2' },
        { name: 'theme-color', content: '#070b14' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'CSMS' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
    },
  },
})
