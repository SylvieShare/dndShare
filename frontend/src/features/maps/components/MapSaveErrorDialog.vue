<template>
  <AppModalFrame
    v-if="open"
    title="Не удалось сохранить карту"
    close-label="Закрыть сообщение об ошибке"
    :width="480"
    :z-index="3500"
    @close="open = false"
  >
    <p role="alert">{{ editor.saveError }}</p>
    <template #footer>
      <ActionButton variant="secondary" @click="open = false"
        >Вернуться к карте</ActionButton
      >
      <ActionButton
        v-if="editor.conflict"
        variant="secondary"
        @click="confirmReload = true"
        >Загрузить с сервера</ActionButton
      >
      <ActionButton
        v-if="!editor.conflict"
        :loading="editor.saving"
        @click="editor.save"
        >Повторить сохранение</ActionButton
      >
    </template>
  </AppModalFrame>
  <ConfirmDialog
    v-if="confirmReload"
    title="Загрузить карту с сервера?"
    message="Несохранённые правки этой карты будут удалены из очереди в браузере."
    confirm-label="Загрузить"
    cancel-label="Отмена"
    :z-index="3600"
    @confirm="reload"
    @cancel="confirmReload = false"
  />
</template>
<script setup>
import { ref, watch } from 'vue'
import {
  ActionButton,
  AppModalFrame,
  ConfirmDialog,
} from '@sylvieshare/share-ui'
const props = defineProps({ editor: Object })
const open = ref(false),
  confirmReload = ref(false)
function reload(){confirmReload.value=false;open.value=false;props.editor.reload()}
watch(
  () => props.editor.saveError,
  (error) => {
    open.value = !!error
  },
  { immediate: true },
)
</script>
