<template>
  <LoadingState v-if="editor.loadingModels" label="Загружаем плитки…" />
  <div v-else-if="editor.modelError" class="map-error" role="alert">
    {{ editor.modelError }}
    <ActionButton variant="secondary" @click="editor.retryModels"
      >Повторить</ActionButton
    >
  </div>
  <template v-else>
    <ActionButton
      :variant="editor.tool === 'wall-brush' ? 'primary' : 'secondary'"
      :aria-pressed="editor.tool === 'wall-brush'"
      @click="toggleWalls"
      ><Paintbrush :size="16" />Кисть стенами</ActionButton
    >
    <FormSelect v-model:value="type" aria-label="Тип плитки">
      <option v-for="option in types" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </FormSelect>
    <FormSelect v-model:value="wall" aria-label="Расположение стен">
      <option v-for="option in walls" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </FormSelect>
    <p class="map-hint">
      Выберите плитку, затем нажмите на карте. R — поворот, Esc — отмена. На
      карте:
      {{ editor.draft.document.tiles.length }}.
    </p>
    <div class="map-model-grid">
      <BaseTile
        v-for="model in filtered"
        :key="model.id"
        class="map-model-card"
        interactive
        :framed="editor.selectedModel === model.id"
        :tint="editor.selectedModel === model.id"
        role="button"
        tabindex="0"
        :aria-label="model.name"
        :title="`${model.sourceCode} · ${model.sourceName} · Выберите для размещения`"
        @click="emit('model', model.id, $event)"
        @dragstart.prevent
        @keydown.enter.prevent.stop="emit('model', model.id, $event)"
        @keydown.space.prevent.stop="emit('model', model.id, $event)"
      >
        <img
          :src="model.previewUrl"
          alt=""
          width="112"
          height="112"
          loading="lazy"
          draggable="false"
        />
        <span class="map-model-name">{{ model.name }}</span>
        <span class="map-model-code">{{ model.sourceCode }}</span>
        <span class="map-model-code" v-if="model.width > 1 || model.height > 1"
          >{{ model.width }} × {{ model.height }} клетки</span
        >
        <span class="map-model-code" v-if="model.supportSlots?.length"
          >Слотов: {{ model.supportSlots.length }}</span
        >
      </BaseTile>
    </div>
    <p v-if="!filtered.length" class="map-hint">
      Плиток с такими фильтрами нет.
    </p>
  </template>
</template>
<script setup>
import { computed, ref, watch } from "vue";
import { Paintbrush } from "@lucide/vue";
import { latestModelVersions } from "../lib/modelVersions";
import {
  ActionButton,
  BaseTile,
  FormSelect,
  LoadingState,
} from "@sylvieshare/share-ui";
const props = defineProps({ editor: { type: Object, required: true } });
const emit = defineEmits(["model", "tool"]);
watch(
  () => props.editor.collection,
  () => {
    props.editor.resetGesture();
    props.editor.setTileSelection([]);
  },
);
function toggleWalls() {
  emit("tool", props.editor.tool === "wall-brush" ? "select" : "wall-brush");
}
const type = ref("all"),
  wall = ref("all");
const walls = [
  { value: "all", label: "Любое расположение стен" },
  { value: "none", label: "Без стен" },
  { value: "straight", label: "Прямая стена" },
  { value: "angle", label: "Угол" },
  { value: "tee", label: "Т-образная" },
  { value: "cross", label: "Х-образная" },
  { value: "corner", label: "Угловой выступ" },
];
const types = [
  { value: "all", label: "Все" },
  { value: "floor", label: "Пол" },
  { value: "wall", label: "Стены" },
  { value: "stairs", label: "Лестницы" },
  { value: "frame", label: "Каркасы" },
  { value: "prop", label: "Декор" },
];
const filtered = computed(() =>
  latestModelVersions(props.editor.catalogue).filter(
    (m) =>
      m.collection === props.editor.collection &&
      (type.value === "all" || m.tileType === type.value) &&
      (wall.value === "all" || m.wallLayout === wall.value),
  ),
);
</script>
<style scoped>
.map-model-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
}
.map-model-card {
  display: flex;
  height: auto;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
  padding: 6px;
  cursor: pointer;
  touch-action: none;
  user-select: none;
}
.map-model-card img {
  width: 100%;
  height: 105px;
  object-fit: contain;
  border-radius: 6px;
  pointer-events: none;
}
.map-model-name {
  display: block;
  white-space: normal;
  font-size: 12px;
  line-height: 1.3;
}
.map-model-code {
  display: block;
  font-family: var(--font-mono);
  font-size: 10px;
  opacity: 0.7;
}
</style>
