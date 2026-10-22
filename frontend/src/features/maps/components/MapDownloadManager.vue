<template>
  <BaseTile
    v-if="progress?.remaining"
    class="map-download-manager"
    role="region"
    aria-label="Загрузка моделей"
  >
    <div class="map-download-heading">
      <Download :size="14" aria-hidden="true" />
      <strong>Загрузка моделей</strong>
      <span>{{ progress.ready }}/{{ progress.total }}</span>
    </div>
    <progress
      class="map-download-progress"
      aria-label="Прогресс загрузки моделей"
      :max="
        progress.unknown
          ? progress.total
          : progress.totalBytes || progress.total
      "
      :value="
        progress.unknown || !progress.totalBytes
          ? progress.ready
          : progress.loadedBytes
      "
    />
    <div
      v-for="group in progress.groups.filter((g) => g.remaining > 0)"
      :key="group.kind"
      class="map-download-row"
      :aria-label="`${labels[group.kind]}: осталось ${group.remaining} из ${group.total}`"
    >
      <span>{{ labels[group.kind] }}</span>
      <span :title="`Готово ${group.ready} из ${group.total}`"
        >{{ group.remaining }} осталось</span
      >
      <small>{{ bytes(group) }}</small>
    </div>
    <div class="map-download-total">
      <strong>{{ progress.remaining }} осталось</strong>
      <span>{{ bytes(progress) }}</span>
    </div>
    <small class="map-download-status">
      <template v-if="progress.active">В работе {{ progress.active }}</template>
      <template v-if="progress.queued"
        >{{ progress.active ? " · " : "" }}В очереди
        {{ progress.queued }}</template
      >
      <template v-if="progress.processing">
        · Подготовка {{ progress.processing }}</template
      >
    </small>
    <small v-if="progress.retrying" class="map-download-status" role="status"
      >Повторяем загрузку: {{ progress.retrying }} · с задержкой до 30 с</small
    >
    <ActionButton
      v-if="progress.errors?.length"
      variant="quiet"
      @click="emit('details')"
      >Подробности ошибок ({{ progress.errors.length }})</ActionButton
    >
    <ActionButton
      v-if="progress.failed || progress.retrying"
      variant="quiet"
      @click="emit('retry')"
    >
      <template #icon><RotateCw :size="13" /></template>Повторить загрузку ({{
        progress.failed + progress.retrying
      }})
    </ActionButton>
  </BaseTile>
</template>
<script setup>
import { ActionButton, BaseTile } from "@sylvieshare/share-ui";
import { Download, RotateCw } from "@lucide/vue";
import { formatBytes } from "@/shared/lib/storageUsage";
defineProps({ progress: Object });
const emit = defineEmits(["retry", "details"]);
const labels = {
  render: "Основные",
  lod: "LOD",
  shadow: "Тени",
  other: "Другое",
  catalogue: "Каталог",
};
function bytes(progress) {
  if (progress.unknown)
    return progress.remainingBytes
      ? `≥ ${formatBytes(progress.remainingBytes)}`
      : "Объём уточняется";
  return formatBytes(progress.remainingBytes);
}
</script>
<style scoped>
.map-download-manager {
  width: 248px;
  max-width: 100%;
  padding: 10px 12px;
  color: var(--text-1);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.map-download-heading,
.map-download-row,
.map-download-total {
  display: flex;
  align-items: center;
  gap: 8px;
}
.map-download-heading strong {
  flex: 1;
  font-size: 12px;
}
.map-download-heading > span,
.map-download-status,
.map-download-row {
  color: var(--text-muted);
}
.map-download-progress {
  display: block;
  width: 100%;
  height: 5px;
  margin: 8px 0;
  accent-color: var(--accent);
}
.map-download-row {
  margin: 4px 0;
}
.map-download-row > span:first-child {
  flex: 1;
}
.map-download-row small {
  min-width: 64px;
  text-align: right;
  font-size: inherit;
}
.map-download-total {
  justify-content: space-between;
  margin-top: 8px;
  padding-top: 7px;
  border-top: 1px solid var(--border);
}
.map-download-status {
  display: block;
  margin-top: 5px;
  font-size: 10px;
}
</style>
