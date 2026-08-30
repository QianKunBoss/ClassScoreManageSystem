<script setup lang="ts">
import type { School } from '~/types'
import { formatDate } from '~/utils/format'

definePageMeta({ middleware: 'super-admin', layout: 'superadmin' })

const toast = useToast()

// 学校管理
const schools = ref<School[]>([])
const loading = ref(true)

// 封禁确认
const confirmToggleSchool = ref<School | null>(null)

// ===== 删除学校（双模态框流程）=====
const deletingSchool = ref<School | null>(null)   // 主确认框：目标学校
const deleteMode = ref<'school' | 'all'>('school') // 仅删除学校 / 包括所有数据
const deletePassword = ref('')
const deleteConfirmText = ref('')
const showFinalConfirm = ref(false)                // 二次确认框
const deleting = ref(false)

const canProceed = computed(() =>
  !!deletePassword.value.trim() && deleteConfirmText.value === '确认删除'
)

async function loadSchools() {
  loading.value = true
  try {
    // 超级管理员需要看到所有学校（包括被封禁的）
    const res = await $fetch<{ data: School[] }>('/api/schools', {
      params: { includeDisabled: '1' }
    })
    schools.value = res.data
  } catch { toast.error('加载学校失败') }
  finally { loading.value = false }
}

// 封禁 / 启用
async function toggleSchoolDisabled(school: any) {
  confirmToggleSchool.value = school
}

async function confirmToggleSchoolDisabled() {
  const school = confirmToggleSchool.value
  if (!school) return
  const newStatus = school.disabled === 1 ? 0 : 1
  try {
    await $fetch(`/api/schools/${school.id}`, {
      method: 'PATCH',
      body: { disabled: newStatus },
    })
    toast.success(`学校已${newStatus === 1 ? '封禁' : '启用'}`)
    confirmToggleSchool.value = null
    await loadSchools()
  } catch (err) {
    toast.error(err.data?.message || err.data?.statusMessage || '操作失败')
  }
}

// ===== 删除流程 =====
function openDeleteModal(school: School) {
  deletingSchool.value = school
  deleteMode.value = 'school'
  deletePassword.value = ''
  deleteConfirmText.value = ''
  showFinalConfirm.value = false
}

function closeDeleteModal() {
  deletingSchool.value = null
  deletePassword.value = ''
  deleteConfirmText.value = ''
  showFinalConfirm.value = false
}

// 主确认框「下一步」→ 打开二次确认框
function proceedToFinalConfirm() {
  if (!canProceed.value) return
  showFinalConfirm.value = true
}

// 二次确认框「确认删除」→ 真正执行
async function confirmDeleteSchool() {
  const school = deletingSchool.value
  if (!school) return
  deleting.value = true
  try {
    const res = await $fetch<{ success: boolean; message: string }>(`/api/schools/${school.id}`, {
      method: 'DELETE',
      headers: { 'x-confirm-password': deletePassword.value },
      query: { deleteData: deleteMode.value === 'all' ? '1' : '0' },
    })
    toast.success(res.message || '学校已删除')
    closeDeleteModal()
    await loadSchools()
  } catch (err) {
    // 密码错误等：保留模态框，提示错误，让用户重试
    toast.error(err.data?.message || err.data?.statusMessage || '删除失败')
  }
  finally { deleting.value = false }
}

onMounted(loadSchools)
</script>

<template>
  <div>
    <section class="border-b border-slate-800/50">
      <div class="px-4 sm:px-6 lg:px-8 py-6">
        <h1 class="text-xl font-bold text-slate-100 mb-1">学校管理</h1>
        <p class="text-sm text-slate-500">管理已入驻学校，封禁、删除或进入学校详情管理</p>
      </div>
    </section>

    <section class="px-4 sm:px-6 lg:px-8 py-8">
      <div class="glass-card p-6 animate-slide-up">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-bold text-slate-100">学校列表</h2>
          <span class="text-xs text-slate-500">共 {{ schools.length }} 所学校</span>
        </div>
        <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div v-for="i in 3" :key="i" class="h-24 rounded-lg bg-slate-800/40 animate-pulse"></div>
        </div>
        <div v-else-if="schools.length === 0" class="text-center py-8 text-sm text-slate-500">暂无学校，请先前往「入驻申请」审核</div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div v-for="s in schools" :key="s.id" class="flex items-center justify-between p-3 rounded-lg bg-slate-800/20 hover:bg-slate-800/40 transition-all" :class="s.disabled === 1 ? 'opacity-60' : ''">
            <div>
              <div class="text-sm font-medium text-slate-200">{{ s.name }}</div>
              <div class="text-xs text-slate-500 mt-0.5">ID: {{ s.id }} · {{ formatDate(s.createdAt) }}</div>
              <div v-if="s.disabled === 1" class="text-xs text-red-400 mt-0.5"><MorphIcon name="ban" size="1em" class="inline-block align-middle" /> 已封禁</div>
            </div>
            <div class="flex items-center gap-2">
              <button
                v-if="s.disabled !== 1"
                @click="toggleSchoolDisabled(s)"
                class="btn btn-ghost text-xs py-1 px-2 !text-red-400 hover:!bg-red-500/10"
              >
                封禁
              </button>
              <button
                v-else
                @click="toggleSchoolDisabled(s)"
                class="btn btn-ghost text-xs py-1 px-2 !text-emerald-400 hover:!bg-emerald-500/10"
              >
                启用
              </button>
              <button
                @click="openDeleteModal(s)"
                class="btn btn-ghost text-xs py-1 px-2 !text-red-400 hover:!bg-red-500/10 flex items-center gap-1"
              >
                <MorphIcon name="trash-2" :size="13" class="pointer-events-none" /> 删除
              </button>
              <NuxtLink :to="`/superadmin/schools/${s.id}`" class="btn btn-primary text-xs py-1 px-3">
                管理
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 封禁学校确认 -->
    <UiConfirm
      :show="!!confirmToggleSchool"
      :title="confirmToggleSchool?.disabled === 1 ? '启用学校' : '封禁学校'"
      :message="confirmToggleSchool ? `确定要${confirmToggleSchool.disabled === 1 ? '启用' : '封禁'}学校「${confirmToggleSchool.name}」吗？` : ''"
      :danger="confirmToggleSchool?.disabled !== 1"
      @confirm="confirmToggleSchoolDisabled"
      @cancel="confirmToggleSchool = null"
    />

    <!-- 删除学校 · 主确认框 -->
    <Teleport to="body">
      <div v-if="deletingSchool" class="modal-backdrop animate-scale-in" @click.self="closeDeleteModal">
        <div class="modal-content max-w-md">
          <div class="modal-header">
            <h3 class="text-base font-bold text-red-400"><MorphIcon name="trash-2" :size="16" class="inline-block align-middle" /> 删除学校</h3>
            <button @click="closeDeleteModal" class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500 transition-colors"><MorphIcon name="x" :size="16" class="pointer-events-none" /></button>
          </div>
          <div class="modal-body space-y-4">
            <p class="text-sm text-slate-300">
              正在删除学校 <span class="font-semibold text-slate-100">{{ deletingSchool.name }}</span>（ID: {{ deletingSchool.id }}）。
              请选择删除范围并验证身份。
            </p>

            <!-- 删除范围 -->
            <div class="space-y-2">
              <p class="text-xs font-medium text-slate-400">删除范围</p>
              <label class="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-700/60 cursor-pointer hover:border-brand-500/50 transition-colors" :class="deleteMode === 'school' ? 'bg-brand-500/10 border-brand-500/50' : ''">
                <input type="radio" value="school" v-model="deleteMode" class="mt-0.5" style="accent-color: #4a7ab5" />
                <div>
                  <div class="text-sm text-slate-200">仅删除学校</div>
                  <div class="text-xs text-slate-500">从系统移除学校记录，保留该校数据库文件（用户/积分等数据可恢复）</div>
                </div>
              </label>
              <label class="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-700/60 cursor-pointer hover:border-red-500/50 transition-colors" :class="deleteMode === 'all' ? 'bg-red-500/10 border-red-500/50' : ''">
                <input type="radio" value="all" v-model="deleteMode" class="mt-0.5" style="accent-color: #ef4444" />
                <div>
                  <div class="text-sm text-red-300">包括所有数据</div>
                  <div class="text-xs text-slate-500">同时物理删除该校数据库文件，所有学生、班级、年级与积分记录将永久清除，不可恢复</div>
                </div>
              </label>
            </div>

            <!-- 密码 -->
            <div>
              <label class="text-xs font-medium text-slate-400">超级管理员密码</label>
              <input
                v-model="deletePassword"
                type="password"
                autocomplete="off"
                placeholder="请输入您的登录密码"
                class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700/60 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-brand-500/60"
              />
            </div>

            <!-- 输入确认文字 -->
            <div>
              <label class="text-xs font-medium text-slate-400">请输入 <span class="text-red-400 font-semibold">确认删除</span> 以继续</label>
              <input
                v-model="deleteConfirmText"
                type="text"
                autocomplete="off"
                placeholder="确认删除"
                class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700/60 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-brand-500/60"
              />
            </div>

            <p v-if="deleteConfirmText.length && deleteConfirmText !== '确认删除'" class="text-xs text-amber-400">输入内容需与「确认删除」完全一致</p>
          </div>
          <div class="modal-footer">
            <button @click="closeDeleteModal" class="btn btn-ghost">取消</button>
            <button
              @click="proceedToFinalConfirm"
              :disabled="!canProceed"
              :class="canProceed ? 'btn btn-danger' : 'btn btn-danger opacity-50 cursor-not-allowed'"
            >
              下一步
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 删除学校 · 二次确认框 -->
    <Teleport to="body">
      <div v-if="showFinalConfirm && deletingSchool" class="modal-backdrop animate-scale-in" @click.self="showFinalConfirm = false">
        <div class="modal-content max-w-sm">
          <div class="modal-header">
            <h3 class="text-base font-bold text-red-400"><MorphIcon name="alert-triangle" :size="16" class="inline-block align-middle" /> 二次确认</h3>
            <button @click="showFinalConfirm = false" class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500 transition-colors"><MorphIcon name="x" :size="16" class="pointer-events-none" /></button>
          </div>
          <div class="modal-body space-y-3">
            <p class="text-sm text-slate-300">此操作不可逆，请再次确认：</p>
            <div class="p-3 rounded-lg bg-slate-900/50 border border-slate-700/60 text-sm space-y-1.5">
              <div class="flex justify-between"><span class="text-slate-400">学校</span><span class="text-slate-100 font-medium">{{ deletingSchool.name }}</span></div>
              <div class="flex justify-between">
                <span class="text-slate-400">范围</span>
                <span :class="deleteMode === 'all' ? 'text-red-300 font-medium' : 'text-slate-200 font-medium'">
                  {{ deleteMode === 'all' ? '包括所有数据（永久删除）' : '仅删除学校（保留数据）' }}
                </span>
              </div>
            </div>
            <p v-if="deleteMode === 'all'" class="text-xs text-red-400"><MorphIcon name="alert-triangle" size="1em" class="inline-block align-middle" /> 该校所有学生、班级、年级与积分记录将被永久清除，无法恢复！</p>
          </div>
          <div class="modal-footer">
            <button @click="showFinalConfirm = false" class="btn btn-ghost">返回</button>
            <button @click="confirmDeleteSchool" :disabled="deleting" :class="deleting ? 'btn btn-danger opacity-50 cursor-not-allowed' : 'btn btn-danger'">
              {{ deleting ? '删除中…' : '确认删除' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
