<template>
  <MapInspectorSection title="Нагрузка">
    <template #actions>
      <ToggleSwitch
        v-model="enabled"
        aria-label="Измерять нагрузку"
        title="Измерять нагрузку"
      />
    </template>
    <BaseTile class="map-performance-summary" framed>
      <div>
        <span>Кадр CPU</span><strong>{{ ms(totalMs(stats?.cpu)) }}</strong>
      </div>
      <div>
        <span>Кадр GPU</span><strong>{{ ms(totalMs(stats?.gpu)) }}</strong>
      </div>
      <div>
        <span>Обновлений / с</span
        ><strong>{{
          enabled && !stats?.idle ? count(stats?.fps || 0) : "0"
        }}</strong>
      </div>
      <div>
        <span>Режим</span
        ><strong class="map-performance-status">{{
          !enabled ? "Пауза" : stats?.idle ? "Покой" : "Обновляется"
        }}</strong>
      </div>
    </BaseTile>
    <FormSelect
      :value="shownMetric"
      aria-label="Показатель графика нагрузки"
      @update:value="metric = $event"
    >
      <option value="cpu">CPU · подготовка кадра</option>
      <option value="gpu" :disabled="!stats?.gpuSupported">
        GPU · отрисовка
      </option>
    </FormSelect>
    <MapPerformanceChart
      :history="stats?.history || []"
      :metric="shownMetric"
      :parts="parts"
    />
    <dl class="map-performance-parts">
      <div v-for="part in rows" :key="part.id">
        <dt><i :style="{ background: part.color }" />{{ part.label }}</dt>
        <dd>{{ ms(values[part.id]) }}</dd>
        <StatBar
          size="small"
          :color="part.color"
          :percent="
            totalMs(values) ? (values[part.id] / totalMs(values)) * 100 : 0
          "
          :label="part.label"
        />
      </div>
    </dl>
    <p v-if="!stats?.gpuSupported" class="map-hint">
      GPU-таймер недоступен в этом браузере. Показаны замеры CPU.
    </p>
    <p v-else-if="!stats.gpu" class="map-hint">Ожидание GPU-замера…</p>
    <dl class="map-performance-details">
      <div>
        <dt>Вызовы отрисовки</dt>
        <dd>{{ count(stats?.calls || 0) }}</dd>
      </div>
      <div>
        <dt>Треугольники / кадр</dt>
        <dd>{{ count(stats?.triangles || 0) }}</dd>
      </div>
      <div>
        <dt>Изменение сцены</dt>
        <dd>{{ ms(stats?.updateMs) }}</dd>
      </div>
    </dl>
  </MapInspectorSection>
</template>
<script setup>
import { computed, ref, shallowRef, watchEffect } from "vue";
import {
  BaseTile,
  FormSelect,
  StatBar,
  ToggleSwitch,
} from "@sylvieshare/share-ui";
import { CPU_PARTS, GPU_PARTS, totalMs, ms } from "../lib/renderPerformance";
import MapInspectorSection from "./MapInspectorSection.vue";
import MapPerformanceChart from "./MapPerformanceChart.vue";
const props = defineProps({ editor: Object }),
  enabled = ref(true),
  metric = ref("gpu"),
  stats = shallowRef(null);
watchEffect((onCleanup) => {
  if (!enabled.value) return;
  const stop = props.editor.observePerformance?.((value) => {
    stats.value = value;
  });
  onCleanup(() => stop?.());
});
const shownMetric = computed(() =>
  metric.value === "gpu" && stats.value?.gpuSupported ? "gpu" : "cpu",
);
const parts = computed(() =>
  shownMetric.value === "gpu" ? GPU_PARTS : CPU_PARTS,
);
const values = computed(() => stats.value?.[shownMetric.value] || {});
const rows = computed(() => parts.value.filter((p) => values.value[p.id] > 0));
const countFormat = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});
const count = (value) => countFormat.format(value);
</script>
<style scoped>
.map-performance-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 12px;
}
.map-performance-summary div {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.map-performance-summary span,
.map-performance-details dt {
  color: var(--text-muted);
  font-size: 11px;
}
.map-performance-summary strong {
  font-size: 18px;
  font-variant-numeric: tabular-nums;
}
.map-performance-summary .map-performance-status {
  font-size: 13px;
}
.map-performance-parts,
.map-performance-details {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.map-performance-parts > div {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 5px 8px;
  font-size: 11px;
}
.map-performance-parts .stat-bar {
  grid-column: 1/-1;
}
.map-performance-parts dt {
  display: flex;
  align-items: center;
  gap: 6px;
}
.map-performance-parts i {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  flex-shrink: 0;
}
dd {
  margin: 0;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.map-performance-details > div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
</style>
