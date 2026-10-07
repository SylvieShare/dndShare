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
        v-if="!editor.conflict"
        :loading="editor.saving"
        @click="editor.save"
        >Повторить сохранение</ActionButton
      >
    </template>
  </AppModalFrame>
</template>
<script setup>
import { ref, watch } from "vue";
import { ActionButton, AppModalFrame } from "@sylvieshare/share-ui";
const props = defineProps({ editor: Object });
const open = ref(false);
watch(
  () => props.editor.saveError,
  (error) => {
    open.value = !!error;
  },
  { immediate: true },
);
</script>
