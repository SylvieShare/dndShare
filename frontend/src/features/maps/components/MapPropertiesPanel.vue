<template>
  <section class="map-properties" aria-label="Свойства карты">
    <div class="map-last-save" role="status" aria-label="Последнее сохранение">
      <strong>Последнее сохранение</strong>
      <time v-if="editor.lastSavedAt" :datetime="editor.lastSavedAt">{{
        savedTime
      }}</time>
      <span v-else>Ещё не сохранялась</span>
    </div>
    <ToggleSwitch
      v-if="d.kind === 'tiles'"
      label="Показывать точки в пазах"
      :model-value="editor.showAnchors"
      @update:model-value="editor.showAnchors = $event"
    />
    <FormField label="Название" vertical
      ><FormTextInput
        :value="editor.draft.name"
        aria-label="Название карты"
        :maxlength="160"
        @change="
          editor.change((m) => {
            m.name = $event;
          })
        "
    /></FormField>
    <FormField
      label="Ширина"
      :hint="d.kind === 'image' ? 'условные единицы' : 'клеток'"
      ><FormNumberInput
        :value="d.width"
        role="group"
        aria-label="Ширина карты"
        :min="2"
        :max="Math.min(160, Math.floor(16000 / d.height))"
        @change="resize($event, d.height)"
    /></FormField>
    <FormField
      label="Высота"
      :hint="d.kind === 'image' ? 'условные единицы' : 'клеток'"
      ><FormNumberInput
        :value="d.height"
        role="group"
        aria-label="Высота карты"
        :min="2"
        :max="Math.min(160, Math.floor(16000 / d.width))"
        @change="resize(d.width, $event)"
    /></FormField>
    <ToggleSwitch
      v-if="d.kind !== 'image'"
      :model-value="d.grid.visible"
      label="Показывать сетку"
      @update:model-value="
        editor.change(() => {
          d.grid.visible = $event;
        })
      "
    />
    <template v-if="d.kind === 'image-grid'">
      <p class="map-hint">
        Совместите сетку с изображением: сначала задайте число клеток, затем
        смещение в процентах клетки.
      </p>
      <FormField label="Смещение X, %"
        ><FormNumberInput
          :value="Math.round(d.grid.offsetX * 100)"
          :min="-100"
          :max="100"
          @change="
            editor.change(() => {
              d.grid.offsetX = $event / 100;
            })
          "
      /></FormField>
      <FormField label="Смещение Y, %"
        ><FormNumberInput
          :value="Math.round(d.grid.offsetY * 100)"
          :min="-100"
          :max="100"
          @change="
            editor.change(() => {
              d.grid.offsetY = $event / 100;
            })
          "
      /></FormField>
    </template>
    <template v-if="d.kind !== 'tiles'">
      <ActionButton
        variant="secondary"
        :loading="uploading"
        @click="fileInput.click()"
        ><Upload :size="16" />Загрузить фон</ActionButton
      >
      <input
        ref="fileInput"
        type="file"
        hidden
        accept="image/png,image/jpeg,image/webp"
        @change="upload"
      />
      <p class="map-hint">
        PNG, JPEG или WebP до 15 МБ. Загруженная картинка сохраняется вместе с
        картой.
      </p>
      <p v-if="uploadError" class="map-error" role="alert">
        {{ uploadError }}
      </p>
    </template>
    <ConfirmDialog
      v-if="pendingSize"
      title="Уменьшить карту?"
      message="Клетки и объекты за новой границей будут удалены. Действие можно отменить в редакторе."
      confirm-label="Изменить размер"
      :z-index="3200"
      @confirm="
        editor.resize(...pendingSize);
        pendingSize = null;
      "
      @cancel="pendingSize = null"
    />
  </section>
</template>
<script setup>
import { computed, ref } from "vue";
import {
  ActionButton,
  ConfirmDialog,
  FormField,
  FormNumberInput,
  FormTextInput,
  ToggleSwitch,
} from "@sylvieshare/share-ui";
import { Upload } from "@lucide/vue";
const props = defineProps({ editor: { type: Object, required: true } });
const savedTime = computed(
  () =>
    props.editor.lastSavedAt &&
    new Intl.DateTimeFormat("ru-RU", {
      dateStyle: "short",
      timeStyle: "medium",
    }).format(new Date(props.editor.lastSavedAt)),
);
const d = computed(() => props.editor.draft.document),
  fileInput = ref(null),
  uploading = ref(false),
  uploadError = ref(""),
  pendingSize = ref(null);
function resize(w, h) {
  if (w < d.value.width || h < d.value.height) pendingSize.value = [w, h];
  else props.editor.resize(w, h);
}
async function upload(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  if (
    file.size > 15 * 1024 * 1024 ||
    !["image/png", "image/jpeg", "image/webp"].includes(file.type)
  ) {
    uploadError.value = "Выберите PNG, JPEG или WebP до 15 МБ";
    return;
  }
  uploading.value = true;
  uploadError.value = "";
  try {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/storage/images", {
      method: "POST",
      body: form,
    });
    if (!response.ok) throw new Error("Не удалось загрузить изображение");
    const asset = await response.json();
    const bitmap = await createImageBitmap(file);
    const width = Math.min(60, (60 * bitmap.width) / bitmap.height),
      height = (width * bitmap.height) / bitmap.width;
    bitmap.close();
    if (width < 2 || height < 2)
      throw new Error(
        "Изображение слишком вытянуто: используйте соотношение сторон до 30:1",
      );
    props.editor.change((m) => {
      m.document.background = { assetId: asset.upload_id, url: asset.url };
      if (!m.document.zones.length && !m.document.objects.length) {
        m.document.width = Math.round(width * 100) / 100;
        m.document.height = Math.round(height * 100) / 100;
      }
    });
  } catch (cause) {
    uploadError.value = cause.message;
  } finally {
    uploading.value = false;
  }
}
</script>

<style scoped>
.map-last-save {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}
.map-last-save time,
.map-last-save span {
  color: var(--text-muted);
}
</style>
