<template>
  <MapInspectorSection title="Кеш моделей карты">
    <BaseTile class="map-memory-total" framed>
      <Database :size="20" aria-hidden="true" />
      <div>
        <strong>{{
          formatBytes(memory.geometryBytes + memory.textureBytes)
        }}</strong>
        <span>Геометрия и текстуры · {{ memory.files }} файлов</span>
      </div>
    </BaseTile>
    <dl class="map-memory-metrics">
      <div>
        <dt>Размер файлов</dt>
        <dd>{{ formatBytes(memory.fileBytes) }}</dd>
      </div>
      <div>
        <dt>Геометрия</dt>
        <dd>{{ formatBytes(memory.geometryBytes) }}</dd>
      </div>
      <div>
        <dt>Текстуры ≈</dt>
        <dd>{{ formatBytes(memory.textureBytes) }}</dd>
      </div>
      <div>
        <dt>Треугольники</dt>
        <dd>{{ count(memory.triangles) }}</dd>
      </div>
    </dl>
    <div
      v-for="group in memory.groups"
      :key="group.kind"
      class="map-memory-group"
    >
      <component :is="icons[group.kind]" :size="16" aria-hidden="true" />
      <span
        >{{ labels[group.kind] }} <small>×{{ group.files }}</small></span
      >
      <strong>{{ formatBytes(group.fileBytes) }}</strong>
    </div>
    <small class="map-hint"
      >Общие файлы учитываются один раз. Объём текстур приблизительный.</small
    >
  </MapInspectorSection>
</template>
<script setup>
import { computed } from "vue";
import { BaseTile } from "@sylvieshare/share-ui";
import { Box, Database, Layers } from "@lucide/vue";
import MapShadowIcon from "./MapShadowIcon.vue";
import MapInspectorSection from "./MapInspectorSection.vue";
import { formatBytes } from "@/shared/lib/storageUsage";
const props = defineProps({ usage: Object });
const memory = computed(
  () =>
    props.usage || {
      files: 0,
      fileBytes: 0,
      geometryBytes: 0,
      textureBytes: 0,
      triangles: 0,
      groups: [],
    },
);
const labels = { render: "Модели", lod: "LOD", shadow: "Тени" };
const icons = { render: Box, lod: Layers, shadow: MapShadowIcon };
const count = (value) => new Intl.NumberFormat("ru-RU").format(value);
</script>
<style scoped>
.map-memory-total {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  color: var(--accent);
}
.map-memory-total > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.map-memory-total strong {
  font-size: 19px;
  font-variant-numeric: tabular-nums;
}
.map-memory-total span {
  font-size: 11px;
  color: var(--text-muted);
}
.map-memory-metrics {
  margin: 4px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 12px;
}
.map-memory-metrics > div,
.map-memory-group {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
dt,
.map-memory-group small {
  color: var(--text-muted);
}
dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}
.map-memory-group {
  font-size: 12px;
}
.map-memory-group > span {
  flex: 1;
}
.map-memory-group > svg {
  width: 16px;
  height: 16px;
  color: var(--text-muted);
}
.map-memory-group strong {
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
</style>
