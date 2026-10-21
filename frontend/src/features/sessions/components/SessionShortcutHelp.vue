<template>
  <ActionButton variant="secondary" class="session-shortcut-help" :aria-pressed="active" aria-keyshortcuts="?" :title="active ? 'Скрыть подсказки горячих клавиш' : 'Показать подсказки горячих клавиш'" @click="$emit('toggle')"><template #icon><Keyboard :size="18" /></template>{{ active ? 'Скрыть подсказки' : 'Горячие клавиши' }}</ActionButton>
</template>
<script setup>
import { ActionButton } from '@sylvieshare/share-ui'
import { Keyboard } from '@lucide/vue'
defineProps({ active: { type: Boolean, default: false } })
defineEmits(['toggle'])
</script>
