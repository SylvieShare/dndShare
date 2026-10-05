<template>
  <aside class="map-inspector">
    <SlidingTabs v-model="tab" :tabs="tabs" aria-label="Инструменты карты">
      <template #icon="{ tab: item }">
        <span :title="item.label" role="img" :aria-label="item.label">
          <component :is="item.icon" :size="20" aria-hidden="true" />
        </span>
      </template>
    </SlidingTabs>
    <template v-if="tab === 'paint'">
      <MapTilePalette
        :editor="editor"
        @drag-tile="(id, event) => emit('drag-tile', id, event)"
      />
    </template>
    <template v-else-if="tab === 'objects'">
      <p class="map-hint">
        Объекты располагаются поверх покрытия. Выбранный объект можно
        перемещать, поворачивать и открывать.
      </p>
      <FormSelect
        :value="editor.objectKind"
        aria-label="Тип объекта"
        @change="
          editor.objectKind = $event;
          editor.tool = 'object';
        "
        ><option v-for="o in OBJECTS" :key="o.id" :value="o.id">
          {{ o.name }}
        </option></FormSelect
      >
      <ActionButton
        :variant="editor.tool === 'object' ? 'primary' : 'secondary'"
        @click="editor.tool = 'object'"
        ><Plus :size="16" />Разместить на карте</ActionButton
      >
      <template v-if="object">
        <hr />
        <strong>{{ OBJECTS.find((o) => o.id === object.kind)?.name }}</strong>
        <ActionButton
          variant="secondary"
          @click="
            editor.change(() => {
              object.rotation = (object.rotation + 90) % 360;
            })
          "
          ><RotateCw :size="16" />Повернуть на 90°</ActionButton
        >
        <FormField label="Размер"
          ><FormSelect
            :value="object.scale"
            @change="
              editor.change(() => {
                object.scale = Number($event);
              })
            "
            ><option v-for="n in [0.5, 1, 1.5, 2, 3, 4]" :key="n" :value="n">
              {{ n }}×
            </option></FormSelect
          ></FormField
        >
        <ToggleSwitch
          v-if="interactive(object.kind)"
          :model-value="object.open"
          :label="object.kind === 'torch' ? 'Погашен' : 'Открыт'"
          @update:model-value="
            editor.change(() => {
              object.open = $event;
            })
          "
        />
        <ActionButton variant="secondary" @click="editor.removeSelected"
          ><Trash2 :size="16" />Удалить объект</ActionButton
        >
      </template>
    </template>
    <template v-else-if="tab === 'zones'">
      <p class="map-hint">
        Зона может состоять из нескольких областей. В сессии её можно открыть
        целиком.
      </p>
      <ActionButton variant="secondary" @click="editor.addZone"
        ><Plus :size="16" />Новая зона</ActionButton
      >
      <FormSelect
        :value="editor.selectedZone"
        aria-label="Выбранная зона"
        @change="editor.selectedZone = $event"
        ><option value="">Выберите зону</option>
        <option v-for="z in d.zones" :key="z.id" :value="z.id">
          {{ z.name }}
        </option></FormSelect
      >
      <template v-if="zone">
        <FormTextInput
          :value="zone.name"
          aria-label="Название зоны"
          :maxlength="100"
          @change="
            editor.change(() => {
              zone.name = $event;
            })
          "
        />
        <ActionButton
          :variant="editor.tool === 'zone' ? 'primary' : 'secondary'"
          @click="editor.tool = 'zone'"
          ><Square :size="16" />Добавить область</ActionButton
        >
        <ActionButton
          v-if="d.kind !== 'image'"
          :variant="editor.tool === 'zone-brush' ? 'primary' : 'secondary'"
          @click="editor.tool = 'zone-brush'"
          ><Paintbrush :size="16" />Добавить клетки</ActionButton
        >
        <ActionButton
          variant="secondary"
          @click="
            editor.change(() => {
              zone.rects = [];
              zone.cells = [];
            })
          "
          >Очистить разметку</ActionButton
        >
        <ActionButton
          variant="secondary"
          @click="
            editor.change((m) => {
              m.document.zones = m.document.zones.filter(
                (z) => z.id !== zone.id,
              );
            });
            editor.selectedZone = '';
          "
          ><Trash2 :size="16" />Удалить зону</ActionButton
        >
      </template>
    </template>
    <template v-else>
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
          :min="2"
          :max="Math.min(160, Math.floor(16000 / d.height))"
          @change="resize($event, d.height)"
      /></FormField>
      <FormField
        label="Высота"
        :hint="d.kind === 'image' ? 'условные единицы' : 'клеток'"
        ><FormNumberInput
          :value="d.height"
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
  </aside>
</template>
<script setup>
import { computed, ref, watch } from "vue";
import {
  ActionButton,
  ConfirmDialog,
  FormField,
  FormNumberInput,
  FormSelect,
  FormTextInput,
  SlidingTabs,
  ToggleSwitch,
} from "@sylvieshare/share-ui";
import {
  Box,
  Layers,
  Paintbrush,
  Plus,
  RotateCw,
  Square,
  Settings2,
  Trash2,
  Upload,
} from "@lucide/vue";
import { interactive, OBJECTS } from "../lib/mapModel";
import MapTilePalette from "./MapTilePalette.vue";
const props = defineProps({ editor: { type: Object, required: true } });
const emit = defineEmits(["drag-tile"]);
const d = computed(() => props.editor.draft.document),
  tab = ref(d.value.kind === "tiles" ? "paint" : "settings"),
  fileInput = ref(null),
  uploading = ref(false),
  uploadError = ref(""),
  pendingSize = ref(null);
const tabs = computed(() => [
  ...(d.value.kind === "tiles"
    ? [{ key: "paint", label: "Плитки", icon: Layers }]
    : []),
  { key: "objects", label: "Объекты", icon: Box },
  { key: "zones", label: "Зоны", icon: Square },
  { key: "settings", label: "Свойства карты", icon: Settings2 },
]);
const object = computed(() =>
    d.value.objects.find((o) => o.id === props.editor.selectedObject),
  ),
  zone = computed(() =>
    d.value.zones.find((z) => z.id === props.editor.selectedZone),
  );
watch(tab, (v) => {
  props.editor.resetGesture();
  props.editor.hoveredTile = "";
  props.editor.setTileSelection([]);
  props.editor.selectedObject = "";
  props.editor.tool = v === "zones" ? "zone" : "select";
});
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
