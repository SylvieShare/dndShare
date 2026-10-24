<template>
  <AppModalFrame
    title="Карта сессии"
    :width="460"
    :dismissible="!busy"
    @close="emit('close')"
  >
    <form
      id="session-map-tab-name"
      class="session-map-tab-form"
      @submit.prevent="submit"
    >
      <FormField label="Название карты" vertical
        ><FormTextInput
          v-model:value="name"
          aria-label="Название карты сессии"
          :maxlength="160"
          required
          autofocus
          :disabled="busy"
      /></FormField>
      <p v-if="error" class="map-hint" role="alert">{{ error }}</p>
    </form>
    <template #footer
      ><div class="session-map-tab-actions">
        <RemoveButton
          icon="trash"
          :label="`Убрать карту ${map.name}`"
          :disabled="busy"
          @click="emit('remove', map)"
        /><FormActionButtons
          submit-text="Сохранить"
          cancel-text="Отмена"
          :loading="busy"
          :can-submit="!!name.trim()"
          @cancel="emit('close')"
          @submit="submit"
        /></div
    ></template>
  </AppModalFrame>
</template>
<script setup>
import { ref } from "vue";
import {
  AppModalFrame,
  FormActionButtons,
  FormField,
  FormTextInput,
  RemoveButton,
} from "@sylvieshare/share-ui";
const props = defineProps({ map: Object, save: Function });
const emit = defineEmits(["close", "remove"]);
const name = ref(props.map.name),
  busy = ref(false),
  error = ref("");
async function submit() {
  if (busy.value || !name.value.trim()) return;
  busy.value = true;
  error.value = "";
  try {
    await props.save(props.map.id, name.value.trim());
    emit("close");
  } catch (cause) {
    error.value = cause.message;
  } finally {
    busy.value = false;
  }
}
</script>
<style scoped>
.session-map-tab-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.session-map-tab-actions {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
</style>
