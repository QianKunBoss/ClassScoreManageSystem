<script setup lang="ts">
/**
 * 删除学校弹窗（三层保护：范围选择 → 超管密码 + 输入确认文字 → 二次确认）
 * 学校管理页与超管概览的组织图右键菜单共用，保证行为一致。
 */
const props = defineProps<{
  show: boolean
  school: { id: number; name: string } | null
}>()

const emit = defineEmits<{ close: []; deleted: [] }>()

const toast = useToast()

const deleteMode = ref<'school' | 'all'>('school')
const deletePassword = ref('')
const deleteConfirmText = ref('')
const showFinalConfirm = ref(false)
const deleting = ref(false)

const canProceed = computed(() =>
  !!deletePassword.value.trim() && deleteConfirmText.value === '确认删除'
)

watch(() => props.show, (visible) => {
  if (!visible) return
  deleteMode.value = 'school'
  deletePassword.value = ''
  deleteConfirmText.value = ''
  showFinalConfirm.value = false
  deleting.value = false
})

function close() {
  if (deleting.value) return
  emit('close')
}

function proceedToFinalConfirm() {
  if (!canProceed.value) return
  showFinalConfirm.value = true
}

async function confirmDelete() {
  const school = props.school
  if (!school) return
  deleting.value = true
  try {
    const res = await $fetch<{ success: boolean; message: string }>(`/api/schools/${school.id}`, {
      method: 'DELETE',
      headers: { 'x-confirm-password': deletePassword.value },
      query: { deleteData: deleteMode.value === 'all' ? '1' : '0' },
    })
    toast.success(res.message || '学校已删除')
    emit('deleted')
    emit('close')
  } catch (err: any) {
    // 密码错误等：保留弹窗让用户重试
    toast.error(err?.data?.message || err?.data?.statusMessage || '删除失败')
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <!-- 主确认框 -->
  <Teleport to="body">
    <div v-if="show && school" class="modal-backdrop animate-scale-in" @click.self="close">
      <div class="modal-content max-w-md">
        <div class="modal-header">
          <h3 class="text-base font-bold text-red-400"><MorphIcon name="trash-2" :size="16" class="inline-block align-middle" /> 删除学校</h3>
          <button @click="close" class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500 transition-colors"><MorphIcon name="x" :size="16" class="pointer-events-none" /></button>
        </div>
        <div class="modal-body space-y-4">
          <p class="text-sm text-slate-300">
            正在删除学校 <span class="font-semibold text-slate-100">{{ school.name }}</span>（ID: {{ school.id }}）。
            请选择删除范围并验证身份。
          </p>

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
          <button @click="close" class="btn btn-ghost">取消</button>
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

  <!-- 二次确认框 -->
  <Teleport to="body">
    <div v-if="showFinalConfirm && show && school" class="modal-backdrop animate-scale-in" @click.self="showFinalConfirm = false">
      <div class="modal-content max-w-sm">
        <div class="modal-header">
          <h3 class="text-base font-bold text-red-400"><MorphIcon name="alert-triangle" :size="16" class="inline-block align-middle" /> 二次确认</h3>
          <button @click="showFinalConfirm = false" class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500 transition-colors"><MorphIcon name="x" :size="16" class="pointer-events-none" /></button>
        </div>
        <div class="modal-body space-y-3">
          <p class="text-sm text-slate-300">此操作不可逆，请再次确认：</p>
          <div class="p-3 rounded-lg bg-slate-900/50 border border-slate-700/60 text-sm space-y-1.5">
            <div class="flex justify-between"><span class="text-slate-400">学校</span><span class="text-slate-100 font-medium">{{ school.name }}</span></div>
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
          <button @click="confirmDelete" :disabled="deleting" :class="deleting ? 'btn btn-danger opacity-50 cursor-not-allowed' : 'btn btn-danger'">
            {{ deleting ? '删除中…' : '确认删除' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
