<script setup lang="ts">
// $pwa 由客户端插件提供，SSR 阶段不存在，需兜底
const fallback = {
  showInstallPrompt: false,
  isPWAInstalled: false,
  needRefresh: false,
  install: () => Promise.resolve(),
  cancelInstall: () => {},
  updateServiceWorker: () => Promise.resolve(),
  cancelPrompt: () => Promise.resolve(),
}
const pwa = (useNuxtApp().$pwa ?? fallback) as typeof fallback

const showInstall = computed(() => pwa.showInstallPrompt && !pwa.isPWAInstalled)
</script>

<template>
  <!-- 安装引导 -->
  <Transition name="pwa-slide">
    <div
      v-if="showInstall"
      class="fixed bottom-4 left-1/2 z-[100] w-[min(92vw,26rem)] -translate-x-1/2 rounded-xl border border-[#3b82a0]/40 bg-[#0b1220] p-4 shadow-lg shadow-black/40"
    >
      <div class="flex items-center gap-3">
        <img src="/pwa-192x192.png" alt="CSMS" class="h-10 w-10 rounded-lg" >
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-[#dbe7f3]">安装 CSMS 到桌面</p>
          <p class="text-xs text-[#7d93ab]">像原生应用一样离线使用，全屏无浏览器栏</p>
        </div>
      </div>
      <div class="mt-3 flex justify-end gap-2">
        <button
          class="rounded-lg px-3 py-1.5 text-xs text-[#7d93ab] transition hover:text-[#dbe7f3]"
          @click="pwa.cancelInstall()"
        >
          暂不
        </button>
        <button
          class="rounded-lg bg-[#2c81a8] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#3b96c2]"
          @click="pwa.install()"
        >
          安装
        </button>
      </div>
    </div>
  </Transition>

  <!-- 新版本可用提示 -->
  <Transition name="pwa-slide">
    <div
      v-if="pwa.needRefresh"
      class="fixed bottom-4 left-1/2 z-[100] flex w-[min(92vw,26rem)] -translate-x-1/2 items-center gap-3 rounded-xl border border-[#3b82a0]/40 bg-[#0b1220] p-4 shadow-lg shadow-black/40"
    >
      <p class="min-w-0 flex-1 text-sm text-[#dbe7f3]">发现新版本，刷新后生效</p>
      <button
        class="rounded-lg bg-[#2c81a8] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#3b96c2]"
        @click="pwa.updateServiceWorker(true)"
      >
        刷新
      </button>
      <button
        class="rounded-lg px-2 py-1.5 text-xs text-[#7d93ab] transition hover:text-[#dbe7f3]"
        @click="pwa.cancelPrompt()"
      >
        稍后
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.pwa-slide-enter-active,
.pwa-slide-leave-active {
  transition: all 0.3s ease;
}
.pwa-slide-enter-from,
.pwa-slide-leave-to {
  opacity: 0;
  transform: translate(-50%, 1rem);
}
</style>
