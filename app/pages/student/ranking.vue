<script setup lang="ts">
definePageMeta({ middleware: 'student', layout: 'student' })

const toast = useToast()

// 学生信息
const { data: meData } = useFetch('/api/auth/student/me', {
  credentials: 'include',
  server: false,
  immediate: true,
})

const student = computed(() => meData.value?.student || null)

// 同班同学排名
const classmates = ref<any[]>([])
const loading = ref(true)

// 用 watch 代替 onMounted，确保 student 数据就绪后再加载
watch(student, async (val) => {
  if (!val) return
  loading.value = true
  try {
    const res = await $fetch('/api/student/classmates', {
      credentials: 'include',
    })
    classmates.value = res.data || []
  } catch (err) {
    toast.error('加载排名失败')
    console.error(err)
  } finally {
    loading.value = false
  }
}, { immediate: true })

function formatTime(t: string) {
  return t?.slice(5, 16) || ''
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
    <div v-if="!student" class="text-center py-20 text-slate-500">
      正在加载用户信息...
    </div>

    <template v-else>
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-slate-100 mb-1">📊 班级排名</h1>
        <p class="text-sm text-slate-500">
          {{ [student?.gradeName, student?.className].filter(Boolean).join(' - ') || '按积分从高到低排序' }}
        </p>
      </div>

      <!-- 我的排名卡片 -->
      <div class="glass-card p-5 mb-8 flex items-center gap-4 animate-slide-up">
        <div class="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-xl font-bold">
          {{ classmates.findIndex((u: any) => u.id === student.id) + 1 || '-' }}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-bold text-slate-100 truncate">{{ student.actualName || student.username }}</p>
          <p class="text-xs text-slate-500">我的当前排名</p>
        </div>
        <div class="text-right">
          <p class="text-lg font-black text-indigo-400">{{ student.totalScore ?? 0 }}</p>
          <p class="text-xs text-slate-500">积分</p>
        </div>
      </div>

      <!-- 排名列表 -->
      <div class="glass-card overflow-hidden animate-slide-up" style="animation-delay: 0.05s">
        <div v-if="loading" class="p-6 space-y-3">
          <div v-for="i in 8" :key="i" class="h-14 rounded-lg bg-slate-800/40 animate-pulse"></div>
        </div>
        <div v-else-if="classmates.length === 0" class="p-8 text-center text-slate-600 text-sm">
          暂无同学数据
        </div>
        <div v-else>
          <div
            v-for="(u, idx) in classmates"
            :key="u.id"
            class="flex items-center gap-4 px-5 py-3.5 transition-all duration-150"
            :class="u.id === student.id ? 'bg-indigo-500/5 border-l-2 border-indigo-500' : 'hover:bg-slate-800/20'"
          >
            <!-- 名次 -->
            <div
              class="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
              :class="idx === 0 ? 'bg-amber-500/10 text-amber-400' : idx === 1 ? 'bg-slate-400/10 text-slate-300' : idx === 2 ? 'bg-amber-700/10 text-amber-600' : 'text-slate-500'"
            >
              {{ idx + 1 }}
            </div>

            <!-- 姓名 -->
            <div class="flex-1 min-w-0">
              <p class="text-sm" :class="u.id === student.id ? 'font-bold text-indigo-300' : 'text-slate-300'">
                {{ u.actualName || u.username }}
                <span v-if="u.id === student.id" class="text-xs text-indigo-400 ml-1">(我)</span>
              </p>
            </div>

            <!-- 积分 -->
            <div class="text-right">
              <span class="text-sm font-bold" :class="u.totalScore > 0 ? 'text-green-400' : u.totalScore < 0 ? 'text-red-400' : 'text-slate-500'">
                {{ u.totalScore ?? 0 }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
