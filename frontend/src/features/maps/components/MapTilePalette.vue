<template>
  <LoadingState v-if="editor.loadingModels" label="Загружаем плитки…" />
  <div v-else-if="editor.modelError" class="map-error" role="alert">
    {{ editor.modelError }}
    <ActionButton variant="secondary" @click="editor.retryModels"
      >Повторить</ActionButton
    >
  </div>
  <template v-else>
    <FormTextInput
      v-model:value="query"
      placeholder="Название или LC-001…"
      aria-label="Поиск плиток"
    />
    <MultiToggle
      v-model="type"
      block
      :options="types"
      aria-label="Тип плитки"
    />
    <FormSelect v-model:value="wall" aria-label="Расположение стен"
      ><option
        v-for="option in walls"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option></FormSelect
    >
    <div class="map-tool-grid">
      <ActionButton
        v-for="t in tools"
        :key="t.id"
        :variant="editor.tool === t.id ? 'primary' : 'secondary'"
        @click="editor.tool = t.id"
      >
        <component :is="t.icon" :size="16" />{{ t.name }}
      </ActionButton>
    </div>
    <div class="map-tile-orientation">
      <ActionButton
        variant="secondary"
        title="Повернуть плитку · R"
        @click="editor.rotate"
        ><RotateCw :size="16" />{{ editor.placementRotation }}°</ActionButton
      >
    </div>
    <p class="map-hint">
      Выберите плитку и нажмите на клетку. R — поворот, ластик — удалить плитки.
      На карте: {{ editor.draft.document.tiles.length }}.
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
        :aria-pressed="editor.selectedModel === model.id"
        :title="`${model.sourceCode} · ${model.sourceName}`"
        @click="choose(model)"
        @keydown.enter.prevent="choose(model)"
        @keydown.space.prevent="choose(model)"
      >
        <img
          :src="model.previewUrl"
          alt=""
          width="112"
          height="112"
          loading="lazy"
        />
        <span class="map-model-name">{{ model.name }}</span>
        <span class="map-model-code">{{ model.sourceCode }}</span>
      </BaseTile>
    </div>
    <p v-if="!filtered.length" class="map-hint">Плиток по этому запросу нет.</p>
    <template v-if="selectedTile">
      <hr />
      <strong>{{ selectedMetadata?.name || "Плитка" }}</strong>
      <p class="map-hint">
        Клетка {{ selectedTile.x + 1 }}, {{ selectedTile.y + 1 }} ·
        {{ selectedTile.rotation }}°
      </p>
      <ActionButton variant="secondary" @click="editor.rotate"
        ><RotateCw :size="16" />Повернуть выбранную</ActionButton
      >
      <ActionButton variant="secondary" @click="editor.removeSelected"
        ><Trash2 :size="16" />Удалить плитку</ActionButton
      >
    </template>
  </template>
</template>
<script setup>
import { computed, ref } from "vue";
import {
  ActionButton,
  BaseTile,
  FormSelect,
  FormTextInput,
  LoadingState,
  MultiToggle,
} from "@sylvieshare/share-ui";
import {
  Eraser,
  PaintBucket,
  Plus,
  RotateCw,
  Square,
  Trash2,
} from "@lucide/vue";
const props = defineProps({ editor: { type: Object, required: true } });
const query = ref(""),
  type = ref("all"),
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
];
const tools = [
  { id: "brush", name: "Расставлять", icon: Plus },
  { id: "fill", name: "Заполнить", icon: PaintBucket },
  { id: "rect", name: "Область", icon: Square },
  { id: "erase", name: "Ластик", icon: Eraser },
];
const filtered = computed(() =>
  props.editor.catalogue.filter(
    (m) =>
      (type.value === "all" || m.tileType === type.value) &&
      (wall.value === "all" || m.wallLayout === wall.value) &&
      `${m.name} ${m.sourceCode} ${m.sourceName}`
        .toLowerCase()
        .includes(query.value.trim().toLowerCase()),
  ),
);
const selectedTile = computed(() =>
  props.editor.draft.document.tiles.find(
    (t) => t.id === props.editor.selectedTile,
  ),
);
const selectedMetadata = computed(() =>
  props.editor.catalogue.find((m) => m.id === selectedTile.value?.modelId),
);
function choose(model) {
  props.editor.selectedModel = model.id;
  props.editor.tool = "brush";
  props.editor.selectedTile = "";
  props.editor.previewTile = null;
}
</script>
<style scoped>
.map-model-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.map-model-card {
  display: flex;
  height: auto;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
  padding: 6px;
}
.map-model-card img {
  width: 100%;
  height: 105px;
  object-fit: contain;
  border-radius: 6px;
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
.map-tile-orientation {
  display: flex;
  align-items: center;
  gap: 12px;
}
.map-tile-orientation :deep(input) {
  width: 60px;
}
</style>
