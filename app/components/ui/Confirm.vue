<script setup lang="ts">
const props = defineProps<{
  show: boolean
  title?: string
  message?: string
  danger?: boolean
  confirmText?: string
  cancelText?: string
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="modal-backdrop animate-scale-in" @click.self="emit('cancel')">
      <div class="modal-content max-w-sm">
        <div class="modal-header">
          <h3 class="text-base font-bold" :class="danger ? 'text-red-400' : 'text-slate-100'">
            {{ title || '确认操作' }}
          </h3>
          <button @click="emit('cancel')" class="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-500 transition-colors">✕</button>
        </div>
        <div class="modal-body">
          <p class="text-sm text-slate-300">{{ message || '确定要执行此操作吗？' }}</p>
          <slot name="extra" />
        </div>
        <div class="modal-footer">
          <button @click="emit('cancel')" class="btn btn-ghost">{{ cancelText || '取消' }}</button>
          <button @click="emit('confirm')" :class="danger ? 'btn btn-danger' : 'btn btn-primary'">
            {{ confirmText || '确定' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
