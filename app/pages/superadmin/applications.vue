<script setup lang="ts">
import type { Application, School, CreatedAccount } from '~/types'
import { formatDate } from '~/utils/format'

definePageMeta({ middleware: 'super-admin', layout: 'superadmin' })

const toast = useToast()

// 申请审核
const applications = ref<Application[]>([])
const loading = ref(true)
const appFilter = ref<'all' | 'pending' | 'approved' | 'rejected'>('pending')
const reviewingApp = ref<Application | null>(null)
const reviewNote = ref('')
const reviewLoading = ref(false)
const createdAccount = ref<CreatedAccount | null>(null)
const emailInfo = ref<{ sent: boolean; message: string } | null>(null)
const loginUrl = ref('')

// 学校列表（审核通过后刷新概览用，这里仅用于统计）
const schools = ref<School[]>([])

async function loadSchools() {
  try {
    const res = await $fetch<{ data: School[] }>('/api/schools', {
      params: { includeDisabled: '1' }
    })
    schools.value = res.data
  } catch { /* 静默失败，不阻塞申请列表 */ }
}

async function loadApplications() {
  loading.value = true
  try {
    const res = await $fetch<{ data: Application[] }>('/api/applications', {
      query: { status: appFilter.value === 'all' ? undefined : appFilter.value },
    })
    applications.value = res.data
  } catch { toast.error('加载申请失败') }
  finally { loading.value = false }
}

async function openReview(app: Application) {
  reviewingApp.value = app
  reviewNote.value = ''
  emailInfo.value = null
  loginUrl.value = ''
}

function closeReview() {
  reviewingApp.value = null
  createdAccount.value = null
  emailInfo.value = null
  loginUrl.value = ''
  reviewNote.value = ''
}

async function submitReview(status: 'approved' | 'rejected') {
  if (!reviewingApp.value) return
  reviewLoading.value = true
  try {
    const res = await $fetch<{ account: CreatedAccount }>(`/api/applications/${reviewingApp.value.id}`, {
      method: 'PATCH',
      body: { status, reviewNote: reviewNote.value },
    })
    toast.success(status === 'approved' ? '已通过审核' : '已拒绝申请')

    // 记录发信结果与登录地址，用于界面反馈
    loginUrl.value = (res as any).loginUrl || ''
    emailInfo.value = (res as any).email || null
    if (emailInfo.value) {
      emailInfo.value.sent ? toast.success(emailInfo.value.message) : toast.warning(emailInfo.value.message)
    }

    if (status === 'approved' && res.account) {
      // 显示创建的账号信息
      createdAccount.value = res.account
    } else {
      closeReview()
    }

    await Promise.all([loadApplications(), loadSchools()])
  } catch (err) { toast.error(err.data?.message || '操作失败') }
  finally { reviewLoading.value = false }
}

watch(appFilter, loadApplications)

onMounted(() => {
  loadApplications()
  loadSchools()
})
</script>

<template>
  <div>
    <section class="border-b border-slate-800/50">
      <div class="px-4 sm:px-6 lg:px-8 py-6">
        <h1 class="text-xl font-bold text-slate-100 mb-1">入驻申请</h1>
        <p class="text-sm text-slate-500">审核学校入驻申请，通过后自动创建学校与管理员账号</p>
      </div>
    </section>

    <section class="px-4 sm:px-6 lg:px-8 py-8">
      <div class="glass-card p-6 animate-slide-up">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-bold text-slate-100">申请列表</h2>
          <div class="flex items-center gap-2">
            <button @click="appFilter = 'pending'" :class="appFilter === 'pending' ? 'btn btn-primary text-xs' : 'btn btn-ghost text-xs'">待审核</button>
            <button @click="appFilter = 'approved'" :class="appFilter === 'approved' ? 'btn btn-primary text-xs' : 'btn btn-ghost text-xs'">已通过</button>
            <button @click="appFilter = 'rejected'" :class="appFilter === 'rejected' ? 'btn btn-primary text-xs' : 'btn btn-ghost text-xs'">已拒绝</button>
            <button @click="appFilter = 'all'" :class="appFilter === 'all' ? 'btn btn-primary text-xs' : 'btn btn-ghost text-xs'">全部</button>
          </div>
        </div>
        <div v-if="loading" class="space-y-2">
          <div v-for="i in 3" :key="i" class="h-12 rounded-lg bg-slate-800/40 animate-pulse"></div>
        </div>
        <div v-else-if="applications.length === 0" class="text-center py-8 text-sm text-slate-500">暂无申请</div>
        <div v-else class="overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>学校</th>
                <th>学校ID</th>
                <th>范围</th>
                <th>申请人</th>
                <th>联系</th>
                <th>状态</th>
                <th>申请时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="app in applications" :key="app.id">
                <td><span class="text-sm font-medium text-slate-200">{{ app.schoolName }}</span></td>
                <td class="text-xs text-slate-400">{{ app.createdSchoolId ?? app.deletedSchoolId ?? '-' }}</td>
                <td class="text-xs text-slate-400">
                  {{ app.gradeName ? (app.className ? `年级·${app.gradeName} / 班级·${app.className}` : `年级·${app.gradeName}`) : '全校' }}
                </td>
                <td class="text-xs text-slate-300">{{ app.applicantName }}</td>
                <td class="text-xs text-slate-500 leading-relaxed">
                  <div>{{ app.contactPhone || '-' }}</div>
                  <div class="text-slate-400">{{ app.contactEmail || '-' }}</div>
                </td>
                <td>
                  <span v-if="app.status === 'pending'" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-yellow-500/10 text-yellow-400">待审核</span>
                  <span v-else-if="app.status === 'approved'" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-500/10 text-emerald-400">已通过</span>
                  <span v-else class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-500/10 text-red-400">已拒绝</span>
                  <span v-if="app.status === 'approved' && app.schoolDeleted === 1" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-500/10 text-amber-400 ml-1">已删除</span>
                </td>
                <td class="text-xs text-slate-500">{{ formatDate(app.createdAt) }}</td>
                <td>
                  <button v-if="app.status === 'pending'" @click="openReview(app)" class="btn btn-primary text-xs py-1 px-3">审核</button>
                  <span v-else class="text-xs text-slate-500">{{ app.reviewNote || '-' }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- 审核申请弹窗 -->
    <ClientOnly>
      <Teleport to="body">
        <!-- 审核表单 -->
        <div v-if="reviewingApp && !createdAccount" class="modal-backdrop" @click.self="closeReview()">
          <div class="modal-content max-w-lg">
            <div class="modal-header">
              <h3 class="text-base font-bold text-slate-100">审核申请</h3>
              <button @click="closeReview()" class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500"><MorphIcon name="x" :size="16" class="pointer-events-none" /></button>
            </div>
            <div class="modal-body space-y-4">
              <div><span class="text-xs text-slate-400">学校：</span><span class="text-sm text-slate-200">{{ reviewingApp.schoolName }}</span></div>
              <div v-if="reviewingApp.gradeName"><span class="text-xs text-slate-400">年级：</span><span class="text-sm text-slate-200">{{ reviewingApp.gradeName }}</span></div>
              <div v-if="reviewingApp.className"><span class="text-xs text-slate-400">班级：</span><span class="text-sm text-slate-200">{{ reviewingApp.className }}</span></div>
              <div><span class="text-xs text-slate-400">申请人：</span><span class="text-sm text-slate-200">{{ reviewingApp.applicantName }}</span></div>
              <div v-if="reviewingApp.contactPhone || reviewingApp.contactEmail">
                <span class="text-xs text-slate-400">联系：</span>
                <span class="text-sm text-slate-200">{{ reviewingApp.contactPhone }} {{ reviewingApp.contactEmail }}</span>
              </div>
              <div v-if="reviewingApp.reason"><span class="text-xs text-slate-400">理由：</span><p class="text-sm text-slate-300 mt-1">{{ reviewingApp.reason }}</p></div>
              <div>
                <label class="block text-xs text-slate-400 mb-2 uppercase">审核备注</label>
                <textarea v-model="reviewNote" placeholder="可选，填写审核意见" rows="2" class="form-input resize-none text-sm"></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button @click="closeReview()" class="btn btn-ghost">取消</button>
              <button @click="submitReview('rejected')" :disabled="reviewLoading" class="btn bg-red-500/20 text-red-400 hover:bg-red-500/30 text-sm px-4 py-2">拒绝</button>
              <button @click="submitReview('approved')" :disabled="reviewLoading" class="btn btn-primary text-sm px-4 py-2">通过</button>
            </div>
          </div>
        </div>
        <!-- 审核通过 - 显示账号信息 -->
        <div v-else-if="createdAccount" class="modal-backdrop" @click.self="closeReview()">
          <div class="modal-content max-w-lg">
            <div class="modal-header">
              <h3 class="text-base font-bold text-emerald-400"><MorphIcon name="circle-check" size="1em" class="inline-block align-middle" /> 审核通过，账号已创建</h3>
              <button @click="closeReview()" class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500"><MorphIcon name="x" :size="16" class="pointer-events-none" /></button>
            </div>
            <div class="modal-body space-y-4">
              <div class="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <p class="text-sm text-emerald-300 mb-3">请将这些信息发送给申请人，让其登录系统：</p>
                <div class="space-y-2 text-sm">
                  <div class="flex justify-between"><span class="text-slate-400">登录地址：</span><code class="text-slate-200 bg-slate-800/50 px-2 py-0.5 rounded">{{ loginUrl || '（当前系统地址）' }}</code></div>
                  <div class="flex justify-between"><span class="text-slate-400">用户名：</span><code class="text-emerald-300 bg-slate-800/50 px-2 py-0.5 rounded">{{ createdAccount.username }}</code></div>
                  <div class="flex justify-between"><span class="text-slate-400">密码：</span><code class="text-emerald-300 bg-slate-800/50 px-2 py-0.5 rounded">{{ createdAccount.password }}</code></div>
                  <div class="flex justify-between"><span class="text-slate-400">角色：</span><span class="text-slate-200">{{ createdAccount.role === 'school_admin' ? '学校管理员' : createdAccount.role === 'grade_admin' ? '年级管理员' : '班级管理员' }}</span></div>
                  <div class="flex justify-between"><span class="text-slate-400">管辖：</span><span class="text-slate-200">{{ createdAccount.school }}{{ createdAccount.grade ? ' / ' + createdAccount.grade : '' }}{{ createdAccount.class ? ' / ' + createdAccount.class : '' }}</span></div>
                </div>
              </div>
              <p v-if="emailInfo" class="text-xs" :class="emailInfo.sent ? 'text-emerald-400' : 'text-amber-400'">
                <MorphIcon :name="emailInfo.sent ? 'circle-check' : 'alert-triangle'" size="1em" class="inline-block align-middle" />
                {{ emailInfo.sent ? '已自动向申请人邮箱发送审核通过通知' : emailInfo.message }}
              </p>
              <p class="text-xs text-slate-500"><MorphIcon name="alert-triangle" size="1em" class="inline-block align-middle" /> 请提醒申请人登录后立即修改密码</p>
            </div>
            <div class="modal-footer">
              <button @click="closeReview()" class="btn btn-primary text-sm px-4 py-2">我知道了</button>
            </div>
          </div>
        </div>
      </Teleport>
    </ClientOnly>
  </div>
</template>
