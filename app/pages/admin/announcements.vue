<script setup lang="ts">
interface Announcement {
  id: number
  title: string
  content: string
  type: 'info' | 'warning' | 'important'
  active: number
  createdBy: number | null
  createdAt: string
  updatedAt: string | null
}

definePageMeta({ auth: true })

const toast = useToast()
const announcements = ref<Announcement[]>([])
const loading = ref(true)
const showAddModal = ref(false)
const showEditModal = ref(false)
const showDeleteConfirm = ref(false)
const announcementToDelete = ref<Announcement | null>(null)
const editingAnnouncement = ref<Announcement | null>(null)
const newAnnouncement = ref({
  title: '',
  content: '',
  type: 'info' as 'info' | 'warning' | 'important',
  active: 1,
})

// 加载公告列表
async function loadAnnouncements() {
  loading.value = true
  try {
    const res = await $fetch<{ success: boolean, data: Announcement[] }>('/api/announcements/admin')
    announcements.value = res.data || []
  } catch (err) {
    console.error('加载公告失败', err)
    toast.error('加载公告失败')
  } finally {
    loading.value = false
  }
}

onMounted(loadAnnouncements)

// 打开添加模态框
function openAddModal() {
  newAnnouncement.value = {
    title: '',
    content: '',
    type: 'info',
    active: 1,
  }
  showAddModal.value = true
}

// 创建公告
async function createAnnouncement() {
  if (!newAnnouncement.value.title || !newAnnouncement.value.content) {
    toast.error('标题和内容为必填项')
    return
  }
  try {
    await $fetch('/api/announcements', {
      method: 'POST',
      body: newAnnouncement.value,
    })
    showAddModal.value = false
    await loadAnnouncements()
    toast.success('公告已创建')
  } catch (err: any) {
    toast.error(err.data?.message || '创建失败')
  }
}

// 打开编辑模态框
function openEditModal(announcement: Announcement) {
  editingAnnouncement.value = { ...announcement }
  showEditModal.value = true
}

// 更新公告
async function updateAnnouncement() {
  if (!editingAnnouncement.value) return
  if (!editingAnnouncement.value.title || !editingAnnouncement.value.content) {
    toast.error('标题和内容为必填项')
    return
  }
  try {
    await $fetch(`/api/announcements/${editingAnnouncement.value.id}`, {
      method: 'PATCH',
      body: {
        title: editingAnnouncement.value.title,
        content: editingAnnouncement.value.content,
        type: editingAnnouncement.value.type,
        active: editingAnnouncement.value.active,
      },
    })
    showEditModal.value = false
    editingAnnouncement.value = null
    await loadAnnouncements()
    toast.success('公告已更新')
  } catch (err: any) {
    toast.error(err.data?.message || '更新失败')
  }
}

// 切换启用/禁用状态
async function toggleActive(announcement: Announcement) {
  try {
    await $fetch(`/api/announcements/${announcement.id}`, {
      method: 'PATCH',
      body: { active: announcement.active === 1 ? 0 : 1 },
    })
    await loadAnnouncements()
    toast.success(announcement.active === 1 ? '公告已禁用' : '公告已启用')
  } catch (err: any) {
    toast.error(err.data?.message || '操作失败')
  }
}

// 确认删除
function confirmDelete(announcement: Announcement) {
  announcementToDelete.value = announcement
  showDeleteConfirm.value = true
}

// 删除公告
async function deleteAnnouncement() {
  if (!announcementToDelete.value) return
  try {
    await $fetch(`/api/announcements/${announcementToDelete.value.id}`, {
      method: 'DELETE',
    })
    showDeleteConfirm.value = false
    announcementToDelete.value = null
    await loadAnnouncements()
    toast.success('公告已删除')
  } catch (err: any) {
    toast.error(err.data?.message || '删除失败')
  }
}

// 格式化日期
function formatDate(dateStr: string | null) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 类型标签样式
function getTypeStyle(type: string) {
  switch (type) {
    case 'warning':
      return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
    case 'important':
      return 'bg-red-500/10 text-red-400 border-red-500/20'
    default:
      return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
  }
}

// 类型标签文字
function getTypeLabel(type: string) {
  switch (type) {
    case 'warning':
      return '警告'
    case 'important':
      return '重要'
    default:
      return '通知'
  }
}
</script>

<template>
  <div>
    <!-- 页面标题栏 -->
    <section class="border-b border-slate-800/50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-xl font-bold text-slate-100 mb-1">公告管理</h1>
            <p class="text-sm text-slate-500">管理系统公告，向用户展示重要信息</p>
          </div>
          <button @click="openAddModal" class="btn btn-primary">+ 发布公告</button>
        </div>
      </div>
    </section>

    <!-- 公告列表 -->
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="glass-card p-6 animate-slide-up">
        <!-- 加载骨架屏 -->
        <div v-if="loading" class="space-y-3">
          <div v-for="i in 3" :key="i" class="flex items-center gap-4 p-4 animate-pulse">
            <div class="w-12 h-12 rounded-lg bg-slate-800"></div>
            <div class="flex-1">
              <div class="w-32 h-3 rounded bg-slate-800 mb-2"></div>
              <div class="w-48 h-2 rounded bg-slate-800/50"></div>
            </div>
          </div>
        </div>

        <!-- 公告卡片列表 -->
        <div v-else-if="announcements.length > 0" class="space-y-4">
          <div
            v-for="a in announcements"
            :key="a.id"
            class="p-4 rounded-xl border border-slate-800/50 hover:border-slate-700/50 transition-colors"
            :class="{ 'opacity-50': a.active === 0 }"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-2">
                  <span
                    class="px-2 py-0.5 rounded text-xs font-medium border"
                    :class="getTypeStyle(a.type)"
                  >
                    {{ getTypeLabel(a.type) }}
                  </span>
                  <span
                    v-if="a.active === 0"
                    class="px-2 py-0.5 rounded text-xs font-medium bg-slate-500/10 text-slate-500 border border-slate-500/20"
                  >
                    已禁用
                  </span>
                </div>
                <h3 class="text-base font-bold text-slate-100 mb-1">{{ a.title }}</h3>
                <p class="text-sm text-slate-400 line-clamp-2">{{ a.content }}</p>
                <p class="text-xs text-slate-600 mt-2">
                  发布于 {{ formatDate(a.createdAt) }}
                  <span v-if="a.updatedAt"> · 更新于 {{ formatDate(a.updatedAt) }}</span>
                </p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <button
                  @click="toggleActive(a)"
                  class="btn btn-ghost text-xs py-1 px-2"
                  :class="a.active === 1 ? '!text-yellow-400 hover:!bg-yellow-500/10' : '!text-green-400 hover:!bg-green-500/10'"
                >
                  {{ a.active === 1 ? '禁用' : '启用' }}
                </button>
                <button
                  @click="openEditModal(a)"
                  class="btn btn-ghost text-xs py-1 px-2"
                >
                  编辑
                </button>
                <button
                  @click="confirmDelete(a)"
                  class="btn btn-ghost text-xs py-1 px-2 !text-red-400 hover:!bg-red-500/10"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-else class="text-center py-12 text-slate-600 text-sm">
          <div class="text-4xl mb-4">📢</div>
          暂无公告，点击右上角「+ 发布公告」创建第一条公告
        </div>
      </div>
    </section>

    <!-- 添加公告模态框 -->
    <ClientOnly>
      <Teleport to="body">
        <div v-if="showAddModal" class="modal-backdrop" @click.self="showAddModal = false">
          <div class="modal-content max-w-lg">
            <div class="modal-header">
              <h3 class="text-base font-bold text-slate-100">发布公告</h3>
              <button @click="showAddModal = false" class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500">✕</button>
            </div>
            <div class="modal-body space-y-4">
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase">标题</label>
                <input v-model="newAnnouncement.title" type="text" placeholder="请输入公告标题" class="form-input" />
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase">内容</label>
                <textarea
                  v-model="newAnnouncement.content"
                  rows="5"
                  placeholder="请输入公告内容，支持 HTML 链接，如 &lt;a href='#'&gt;点击查看&lt;/a&gt;"
                  class="form-input"
                ></textarea>
                <p class="text-xs text-slate-600 mt-1">支持 HTML 标签，可使用 &lt;a&gt; 插入链接</p>
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase">类型</label>
                <select v-model="newAnnouncement.type" class="form-input">
                  <option value="info">通知</option>
                  <option value="warning">警告</option>
                  <option value="important">重要</option>
                </select>
              </div>
              <div class="flex items-center gap-2">
                <input
                  type="checkbox"
                  v-model="newAnnouncement.active"
                  :true-value="1"
                  :false-value="0"
                  class="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500"
                />
                <label class="text-sm text-slate-300">立即启用</label>
              </div>
            </div>
            <div class="modal-footer">
              <button @click="showAddModal = false" class="btn btn-ghost">取消</button>
              <button @click="createAnnouncement" class="btn btn-primary">发布</button>
            </div>
          </div>
        </div>
      </Teleport>
    </ClientOnly>

    <!-- 编辑公告模态框 -->
    <ClientOnly>
      <Teleport to="body">
        <div v-if="showEditModal && editingAnnouncement" class="modal-backdrop" @click.self="showEditModal = false">
          <div class="modal-content max-w-lg">
            <div class="modal-header">
              <h3 class="text-base font-bold text-slate-100">编辑公告</h3>
              <button @click="showEditModal = false" class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500">✕</button>
            </div>
            <div class="modal-body space-y-4">
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase">标题</label>
                <input v-model="editingAnnouncement.title" type="text" placeholder="请输入公告标题" class="form-input" />
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase">内容</label>
                <textarea
                  v-model="editingAnnouncement.content"
                  rows="5"
                  placeholder="请输入公告内容，支持 HTML 链接，如 &lt;a href='#'&gt;点击查看&lt;/a&gt;"
                  class="form-input"
                ></textarea>
                <p class="text-xs text-slate-600 mt-1">支持 HTML 标签，可使用 &lt;a&gt; 插入链接</p>
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-2 uppercase">类型</label>
                <select v-model="editingAnnouncement.type" class="form-input">
                  <option value="info">通知</option>
                  <option value="warning">警告</option>
                  <option value="important">重要</option>
                </select>
              </div>
              <div class="flex items-center gap-2">
                <input
                  type="checkbox"
                  v-model="editingAnnouncement.active"
                  :true-value="1"
                  :false-value="0"
                  class="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500"
                />
                <label class="text-sm text-slate-300">启用</label>
              </div>
            </div>
            <div class="modal-footer">
              <button @click="showEditModal = false" class="btn btn-ghost">取消</button>
              <button @click="updateAnnouncement" class="btn btn-primary">保存</button>
            </div>
          </div>
        </div>
      </Teleport>
    </ClientOnly>

    <!-- 删除确认 -->
    <UiConfirm
      :show="showDeleteConfirm"
      danger
      title="确认删除"
      :message="`确定删除公告「${announcementToDelete?.title}」吗？此操作不可撤销`"
      @confirm="deleteAnnouncement"
      @cancel="showDeleteConfirm = false"
    />
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>