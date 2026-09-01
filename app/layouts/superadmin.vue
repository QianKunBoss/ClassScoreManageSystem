<script setup lang="ts">
import {
  LayoutDashboard, Users, School, Inbox, Palette, Mail, FileText,
  Folder, Shield, ChevronDown, ChevronUp, ArrowLeft, GraduationCap, Database, KeyRound,
} from '~/utils/icons'

const route = useRoute()

const navItems = [
  { to: '/superadmin', label: '概览', icon: LayoutDashboard, exact: true },
  { to: '/superadmin/schools', label: '学校管理', icon: School, exact: false },
  { to: '/superadmin/applications', label: '入驻申请', icon: Inbox, exact: false },
  { to: '/superadmin/data', label: '数据收纳', icon: Database, exact: false },
]

// 用户管理分组（管理员管理 + 学生管理）
const userGroupOpen = ref(false)
const userGroupItems = [
  { to: '/superadmin/admins', label: '管理员账号', icon: Users, exact: false },
  { to: '/superadmin/students', label: '学生管理', icon: GraduationCap, exact: false },
]
userGroupOpen.value = route.path.startsWith('/superadmin/admins') || route.path.startsWith('/superadmin/students')

// 设置收纳盒
const settingsOpen = ref(false)
const settingsItems = [
  { to: '/superadmin/settings/appearance', label: '界面设置', icon: Palette },
  { to: '/superadmin/settings/system', label: '邮件服务', icon: Mail },
  { to: '/superadmin/settings/templates', label: '邮件模板', icon: FileText },
]
// 当前路由在设置组内时默认展开
settingsOpen.value = route.path.startsWith('/superadmin/settings')

const isActive = (item: typeof navItems[number]) =>
  item.exact ? route.path === item.to : route.path.startsWith(item.to)
</script>

<template>
  <div class="min-h-screen flex flex-col bg-[#0a0a1a]">
    <AppNavbar />
    <div class="flex flex-1">
      <!-- 桌面端侧边栏 -->
      <aside class="hidden md:flex flex-col w-56 shrink-0 border-r border-slate-800/50 bg-[#0b1220]/60 sticky top-16 h-[calc(100vh-4rem)]">
        <div class="px-5 py-6 border-b border-slate-800/50">
          <NuxtLink to="/superadmin" class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-brand-500/15 flex items-center justify-center text-base"><MorphIcon :icon="Shield" :size="18" /></div>
            <div>
              <p class="text-sm font-bold text-slate-100">超级管理</p>
              <p class="text-xs text-slate-500">系统管理控制台</p>
            </div>
          </NuxtLink>
        </div>
        <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all"
            :class="isActive(item)
              ? 'bg-brand-500/15 text-brand-400 font-medium'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'"
          >
            <MorphIcon :icon="item.icon" :size="18" class="shrink-0" />
            <span>{{ item.label }}</span>
          </NuxtLink>

          <!-- 用户管理分组 -->
          <div class="pt-2 mt-2 border-t border-slate-800/50">
            <button
              class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all"
              :class="route.path.startsWith('/superadmin/admins') || route.path.startsWith('/superadmin/students')
                ? 'bg-brand-500/15 text-brand-400 font-medium'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'"
              @click="userGroupOpen = !userGroupOpen"
            >
              <MorphIcon :icon="Users" :size="18" class="shrink-0" />
              <span class="flex-1 text-left">用户管理</span>
              <MorphIcon :icon="userGroupOpen ? ChevronUp : ChevronDown" :size="14" class="text-slate-500" />
            </button>
            <Transition name="collapse">
              <div v-if="userGroupOpen" class="mt-1 space-y-1 overflow-hidden">
                <NuxtLink
                  v-for="item in userGroupItems"
                  :key="item.to"
                  :to="item.to"
                  class="flex items-center gap-3 pl-10 pr-3 py-2 rounded-lg text-sm transition-all"
                  :class="isActive(item as any)
                    ? 'bg-brand-500/15 text-brand-400 font-medium'
                    : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/40'"
                >
                  <MorphIcon :icon="item.icon" :size="14" class="shrink-0" />
                  <span>{{ item.label }}</span>
                </NuxtLink>
              </div>
            </Transition>
          </div>

          <!-- 设置收纳盒 -->
          <div class="pt-2 mt-2 border-t border-slate-800/50">
            <button
              class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all"
              :class="route.path.startsWith('/superadmin/settings')
                ? 'bg-brand-500/15 text-brand-400 font-medium'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'"
              @click="settingsOpen = !settingsOpen"
            >
              <MorphIcon :icon="Folder" :size="18" class="shrink-0" />
              <span class="flex-1 text-left">设置</span>
              <MorphIcon :icon="settingsOpen ? ChevronUp : ChevronDown" :size="14" class="text-slate-500" />
            </button>
            <Transition name="collapse">
              <div v-if="settingsOpen" class="mt-1 space-y-1 overflow-hidden">
                <NuxtLink
                  v-for="item in settingsItems"
                  :key="item.to"
                  :to="item.to"
                  class="flex items-center gap-3 pl-10 pr-3 py-2 rounded-lg text-sm transition-all"
                  :class="isActive(item as any)
                    ? 'bg-brand-500/15 text-brand-400 font-medium'
                    : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/40'"
                >
                  <MorphIcon :icon="item.icon" :size="14" class="shrink-0" />
                  <span>{{ item.label }}</span>
                </NuxtLink>
              </div>
            </Transition>
          </div>
        </nav>
        <div class="px-3 py-4 border-t border-slate-800/50 space-y-1">
          <!-- API 凭证页属于校级功能（走 /admin 布局），故放在底部而非 /superadmin 导航组 -->
          <NuxtLink to="/admin/api-tokens" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition-all">
            <MorphIcon :icon="KeyRound" :size="18" class="shrink-0" />
            <span>API 凭证</span>
          </NuxtLink>
          <NuxtLink to="/admin" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 transition-all">
            <MorphIcon :icon="ArrowLeft" :size="18" class="shrink-0" />
            <span>返回管理后台</span>
          </NuxtLink>
        </div>
      </aside>

      <div class="flex-1 min-w-0 flex flex-col">
        <!-- 移动端顶部导航 -->
        <div class="md:hidden sticky top-16 z-30 border-b border-slate-800/50 bg-[#0a0a1a]/95 backdrop-blur px-4 py-2 overflow-x-auto">
          <nav class="flex items-center gap-1">
            <NuxtLink
              v-for="item in navItems"
              :key="item.to"
              :to="item.to"
              class="px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all"
              :class="isActive(item)
                ? 'bg-brand-500/15 text-brand-400 font-medium'
                : 'text-slate-400 hover:text-slate-200'"
            >
              <MorphIcon :icon="item.icon" :size="14" class="shrink-0" /> {{ item.label }}
            </NuxtLink>
            <NuxtLink
              v-for="item in settingsItems"
              :key="item.to"
              :to="item.to"
              class="px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all"
              :class="isActive(item as any)
                ? 'bg-brand-500/15 text-brand-400 font-medium'
                : 'text-slate-400 hover:text-slate-200'"
            >
              <MorphIcon :icon="item.icon" :size="14" class="shrink-0" /> {{ item.label }}
            </NuxtLink>
            <NuxtLink
              v-for="item in userGroupItems"
              :key="item.to"
              :to="item.to"
              class="px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all"
              :class="isActive(item as any)
                ? 'bg-brand-500/15 text-brand-400 font-medium'
                : 'text-slate-400 hover:text-slate-200'"
            >
              <MorphIcon :icon="item.icon" :size="14" class="shrink-0" /> {{ item.label }}
            </NuxtLink>
            <NuxtLink to="/admin" class="px-3 py-1.5 rounded-lg text-xs whitespace-nowrap text-slate-500 flex items-center gap-1"><MorphIcon :icon="ArrowLeft" :size="14" class="shrink-0" /> 后台</NuxtLink>
          </nav>
        </div>

        <main class="flex-1">
          <slot />
        </main>
      </div>
    </div>

    <UiToast />
  </div>
</template>

<style scoped>
.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.2s ease;
}
.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
