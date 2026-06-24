<script setup lang="ts">
import type { Application } from '~/types'

definePageMeta({ auth: false, layout: 'blank' })

const form = reactive({
  schoolName: '',
  applyScope: 'school' as 'school' | 'grade' | 'class',
  gradeName: '',
  className: '',
  applicantName: '',
  contactPhone: '',
  contactEmail: '',
  reason: '',
})

const loading = ref(false)
const submitted = ref(false)
const error = ref('')

// 冲突联系信息弹窗
const showContactModal = ref(false)
const contactInfo = ref<{
  applicantName?: string
  contactPhone?: string | null
  contactEmail?: string | null
  schoolName: string
  existingScope: string
} | null>(null)

async function handleSubmit() {
  if (!form.schoolName.trim() || !form.applicantName.trim()) {
    error.value = '校名和申请人姓名为必填项'
    return
  }
  if (form.applyScope === 'grade' && !form.gradeName.trim()) {
    error.value = '请填写年级名称'
    return
  }
  if (form.applyScope === 'class' && (!form.gradeName.trim() || !form.className.trim())) {
    error.value = '请填写年级和班级名称'
    return
  }

  loading.value = true
  error.value = ''
  try {
    const res = await $fetch('/api/applications', {
      method: 'POST',
      body: {
        schoolName: form.schoolName.trim(),
        gradeName: form.applyScope === 'school' ? null : form.gradeName.trim(),
        className: form.applyScope === 'class' ? form.className.trim() : null,
        applicantName: form.applicantName.trim(),
        contactPhone: form.contactPhone.trim() || null,
        contactEmail: form.contactEmail.trim() || null,
        reason: form.reason.trim() || null,
      },
    })
    // 处理冲突响应（后端返回 409，fetch 会抛异常，此处为兜底）
    if (res?.code === 'EXISTING_APPLICATION' || res?.code === 'EXISTING_SCHOOL') {
      contactInfo.value = res.contact ?? { schoolName: form.schoolName, existingScope: '未知' }
      showContactModal.value = true
      return
    }
    submitted.value = true
  } catch (err) {
    const body = err.data
    // 后端对冲突情况返回 409 + 特殊 code，fetch 会进入 catch
    if (body?.code === 'EXISTING_APPLICATION' || body?.code === 'EXISTING_SCHOOL') {
      contactInfo.value = body.contact ?? { schoolName: form.schoolName, existingScope: '未知' }
      showContactModal.value = true
      return
    }
    error.value = body?.message || '提交失败，请重试'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="w-full max-w-lg px-4">
    <!-- 背景光效 -->
    <div class="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl"></div>
      <div class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl"></div>
    </div>

    <div class="animate-fade-in">
      <!-- 标题 -->
      <div class="text-center mb-8">
        <NuxtLink to="/" class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-2xl shadow-2xl shadow-indigo-500/25 mb-4">
          C
        </NuxtLink>
        <h1 class="text-2xl font-bold text-slate-100 mb-1">申请入驻</h1>
        <p class="text-sm text-slate-500">填写以下信息，提交入驻申请</p>
      </div>

      <!-- 成功提示 -->
      <div v-if="submitted" class="glass-card p-8 text-center animate-slide-up">
        <div class="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-3xl mx-auto mb-4">✅</div>
        <h2 class="text-xl font-bold text-slate-100 mb-2">申请已提交</h2>
        <p class="text-sm text-slate-500 mb-6">我们会尽快审核您的申请，审核结果将通过联系方式通知您。</p>
        <NuxtLink to="/login" class="btn btn-primary">返回登录</NuxtLink>
      </div>

      <!-- 表单 -->
      <div v-else class="glass-card p-8">
        <form @submit.prevent="handleSubmit" class="space-y-5">
          <!-- 申请人姓名 -->
          <div>
            <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">申请人姓名 <span class="text-red-400">*</span></label>
            <input
              v-model="form.applicantName"
              type="text"
              placeholder="请输入您的姓名"
              class="form-input"
              :disabled="loading"
            />
          </div>

          <!-- 学校名称 -->
          <div>
            <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">学校名称 <span class="text-red-400">*</span></label>
            <input
              v-model="form.schoolName"
              type="text"
              placeholder="请输入学校全称"
              class="form-input"
              :disabled="loading"
            />
          </div>

          <!-- 申请范围 -->
          <div>
            <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">申请范围 <span class="text-red-400">*</span></label>
            <div class="flex gap-2">
              <button
                type="button"
                @click="form.applyScope = 'school'"
                :class="form.applyScope === 'school' ? 'btn btn-primary text-sm' : 'btn btn-ghost text-sm'"
              >学校入驻</button>
              <button
                type="button"
                @click="form.applyScope = 'grade'"
                :class="form.applyScope === 'grade' ? 'btn btn-primary text-sm' : 'btn btn-ghost text-sm'"
              >年级申请</button>
              <button
                type="button"
                @click="form.applyScope = 'class'"
                :class="form.applyScope === 'class' ? 'btn btn-primary text-sm' : 'btn btn-ghost text-sm'"
              >班级申请</button>
            </div>
          </div>

          <!-- 年级名称 -->
          <div v-if="form.applyScope === 'grade' || form.applyScope === 'class'">
            <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">年级名称 <span class="text-red-400">*</span></label>
            <input
              v-model="form.gradeName"
              type="text"
              :placeholder="form.applyScope === 'grade' ? '如：初一、高二' : '如：初一'"
              class="form-input"
              :disabled="loading"
            />
          </div>

          <!-- 班级名称 -->
          <div v-if="form.applyScope === 'class'">
            <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">班级名称 <span class="text-red-400">*</span></label>
            <input
              v-model="form.className"
              type="text"
              placeholder="如：1班、实验班"
              class="form-input"
              :disabled="loading"
            />
          </div>

          <!-- 联系电话 -->
          <div>
            <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">联系电话</label>
            <input
              v-model="form.contactPhone"
              type="tel"
              placeholder="请输入联系电话"
              class="form-input"
              :disabled="loading"
            />
          </div>

          <!-- 电子邮箱 -->
          <div>
            <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">电子邮箱</label>
            <input
              v-model="form.contactEmail"
              type="email"
              placeholder="请输入电子邮箱"
              class="form-input"
              :disabled="loading"
            />
          </div>

          <!-- 申请理由 -->
          <div>
            <label class="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">申请理由</label>
            <textarea
              v-model="form.reason"
              placeholder="请简要说明申请理由（选填）"
              rows="3"
              class="form-input resize-none"
              :disabled="loading"
            ></textarea>
          </div>

          <!-- 错误提示 -->
          <div
            v-if="error"
            class="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2"
          >
            <span>⚠</span> {{ error }}
          </div>

          <!-- 提交按钮 -->
          <button
            type="submit"
            :disabled="loading"
            class="btn btn-primary w-full py-3"
          >
            <span v-if="loading" class="flex items-center gap-2">
              <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              提交中...
            </span>
            <span v-else>提交申请</span>
          </button>
        </form>
      </div>

      <p class="text-center text-xs text-slate-700 mt-6">
        <NuxtLink to="/login" class="text-indigo-400 hover:text-indigo-300 transition-colors">已有账号？返回登录</NuxtLink>
      </p>
    </div>
  </div>

  <!-- 联系信息弹窗 -->
  <div v-if="showContactModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
    <!-- 遮罩 -->
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="showContactModal = false"></div>
    <!-- 弹窗内容 -->
    <div class="relative glass-card p-6 max-w-sm w-full animate-slide-up">
      <div class="text-center mb-5">
        <div class="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-2xl mx-auto mb-3">📋</div>
        <h3 class="text-base font-bold text-slate-100">该校已有申请记录</h3>
        <p class="text-xs text-slate-500 mt-1">
          现有管理范围：{{ contactInfo?.existingScope || '未知' }}
        </p>
      </div>

      <div class="space-y-2.5 mb-5">
        <div v-if="contactInfo?.applicantName" class="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/30">
          <span class="text-slate-500 text-sm w-5 text-center">👤</span>
          <div class="min-w-0">
            <p class="text-xs text-slate-500">申请人</p>
            <p class="text-sm text-slate-200 truncate">{{ contactInfo.applicantName }}</p>
          </div>
        </div>
        <div v-if="contactInfo?.contactPhone" class="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/30">
          <span class="text-slate-500 text-sm w-5 text-center">📱</span>
          <div class="min-w-0">
            <p class="text-xs text-slate-500">联系电话</p>
            <a :href="`tel:${contactInfo.contactPhone}`" class="text-sm text-indigo-400 hover:underline">{{ contactInfo.contactPhone }}</a>
          </div>
        </div>
        <div v-if="contactInfo?.contactEmail" class="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/30">
          <span class="text-slate-500 text-sm w-5 text-center">📧</span>
          <div class="min-w-0">
            <p class="text-xs text-slate-500">电子邮箱</p>
            <a :href="`mailto:${contactInfo.contactEmail}`" class="text-sm text-indigo-400 hover:underline break-all">{{ contactInfo.contactEmail }}</a>
          </div>
        </div>
        <div v-if="!contactInfo?.contactPhone && !contactInfo?.contactEmail" class="text-center text-xs text-slate-500 py-1">
          您所申请的分级低于现存的管理分级，请通过学校官方渠道联系相关管理员添加。
        </div>
      </div>

      <button
        @click="showContactModal = false"
        class="btn btn-primary w-full py-2.5 text-sm"
      >
        我知道了
      </button>
    </div>
  </div>
</template>

