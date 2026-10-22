<template>
  <form class="map-image-form" @submit.prevent="submit">
    <FormField label="Название" vertical
      ><FormTextInput
        :value="name"
        required
        :maxlength="160"
        @update:value="name = $event"
    /></FormField>
    <FormField label="Изображение" hint="PNG, JPEG или WebP, до 64 Мп" vertical
      ><input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        required
        @change="file = $event.target.files[0]"
    /></FormField>
    <FormField label="Ширина сетки, клеток" vertical
      ><FormNumberInput
        :value="width"
        :min="2"
        :max="160"
        @change="width = $event"
    /></FormField>
    <p class="map-hint">
      Высота определяется по пропорциям изображения. Размер клетки и смещение
      изображения можно настроить после открытия.
    </p>
    <p v-if="error" role="alert" class="map-error">{{ error }}</p>
    <ActionButton type="submit" :disabled="busy || !file">{{
      busy ? "Загружаем…" : "Добавить 2D карту"
    }}</ActionButton>
  </form>
</template>
<script setup>
import { ref } from "vue";
import {
  ActionButton,
  FormField,
  FormTextInput,
  FormNumberInput,
} from "@sylvieshare/share-ui";
import { uploadSessionMapImage } from "@/shared/api/mapsApi";
const props = defineProps({ uuid: String });
const emit = defineEmits(["created"]);
const name = ref("Новая 2D карта"),
  file = ref(null),
  width = ref(30),
  busy = ref(false),
  error = ref("");
async function submit() {
  busy.value = true;
  error.value = "";
  try {
    const map = await uploadSessionMapImage(
      props.uuid,
      file.value,
      name.value,
      width.value,
    );
    emit("created", map);
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
</script>
<style scoped>
.map-image-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
</style>
