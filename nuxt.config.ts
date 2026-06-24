import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  // 生产环境关闭 devtools
  devtools: { enabled: process.env.NODE_ENV !== 'production' },

  modules: ['@nuxtjs/color-mode', 'nuxt-auth-utils'],

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
        { name: 'description', content: '班级积分管理系统 v0.3.0' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      ],
    },
  },
})
