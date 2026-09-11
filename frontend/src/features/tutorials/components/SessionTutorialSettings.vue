<template>
  <ActionButton ref="trigger" variant="quiet" @click="open = !open">Настройки</ActionButton>
  <BasePopover v-model:open="open" :anchor="trigger?.$el" :min-width="260">
    <div data-tutorial="session-settings">
      <TutorialRestart @restart="open = false" />
    </div>
  </BasePopover>
</template>
<script setup>
import { ref } from 'vue'
import { ActionButton, BasePopover } from '@sylvieshare/share-ui'
import TutorialRestart from './TutorialRestart.vue'
import { useTutorialAction } from '../composables/useTutorialAction'
const trigger = ref(null)
const open = ref(false)
useTutorialAction('session-settings', ({ onCleanup }) => {
  const previous = open.value
  onCleanup(() => { open.value = previous })
  open.value = true
})
</script>
