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
    // nuxt-auth-utils session 加密密钥（从 .env 的 SESSION_SECRET 读取）
    session: {
      password: process.env.SESSION_SECRET || 'csms-dev-secret-change-in-production',
      name: 'csms-session',
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
        { name: 'description', content: '班级积分管理系统 v0.3.1' },
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
