<template>
  <AppModalFrame
    title="Проблемы загрузки карты"
    :width="760"
    close-label="Закрыть сведения об ошибках"
    @close="emit('close')"
  >
    <div class="map-loading-errors">
      <section v-for="issue in issues" :key="issue.key">
        <h3>
          {{
            issue.kind === "model-missing"
              ? "Модель отсутствует в каталоге"
              : issue.kind === "file-missing"
                ? "Файл модели отсутствует"
                : "Ресурс не удалось загрузить"
          }}
        </h3>
        <p>{{ issue.message }}</p>
        <dl>
          <dt>Этап</dt>
          <dd>{{ MODEL_STAGES[issue.stage] || issue.stage }}</dd>
          <template v-if="issue.modelName"
            ><dt>Модель</dt>
            <dd>
              {{ issue.modelName }} · {{ issue.definitionId || issue.modelId }}
            </dd></template
          >
          <template v-if="issue.assetKind"
            ><dt>Ресурс</dt>
            <dd>
              {{ MODEL_KINDS[issue.assetKind] || issue.assetKind }}
            </dd></template
          >
          <template
            v-if="
              issue.statusCode ||
              (issue.status && typeof issue.status === 'number')
            "
            ><dt>HTTP</dt>
            <dd>{{ issue.statusCode || issue.status }}</dd></template
          >
          <template v-if="issue.attempt"
            ><dt>Попытка</dt>
            <dd>{{ issue.attempt }}</dd></template
          >
          <template v-if="issue.url"
            ><dt>Запрос</dt>
            <dd>{{ path(issue.url) }}</dd></template
          >
        </dl>
        <p v-if="issue.retryable" class="map-hint">
          Это не подтверждение отсутствия модели. Автоматические попытки
          продолжаются с паузами до 30 секунд; окно можно закрыть.
        </p>
        <ul v-if="issue.modelIds?.length">
          <li v-for="id in issue.modelIds" :key="id">{{ id }}</li>
        </ul>
        <details v-if="affected(issue).length">
          <summary>Элементы карты ({{ affected(issue).length }})</summary>
          <ul>
            <li v-for="entry in affected(issue).slice(0, 50)" :key="entry.id">
              {{ entry.kind }} {{ entry.id }} · модель {{ entry.modelId }} · X
              {{ entry.x }}, Y {{ entry.y
              }}<template v-if="entry.level !== undefined"
                >, уровень {{ entry.level + 1 }}</template
              >
            </li>
          </ul>
          <p v-if="affected(issue).length > 50" class="map-hint">
            Показаны первые 50 элементов из {{ affected(issue).length }}.
          </p>
        </details>
      </section>
      <ActionButton variant="secondary" @click="emit('retry')"
        >Повторить сейчас</ActionButton
      >
    </div>
  </AppModalFrame>
</template>
<script setup>
import { computed } from "vue";
import { ActionButton, AppModalFrame } from "@sylvieshare/share-ui";
import { MODEL_STAGES, MODEL_KINDS } from "../lib/modelLoadError";
const props = defineProps({ issues: Array, document: Object });
const emit = defineEmits(["close", "retry"]);
function path(url) {
  try {
    return new URL(url, location.origin).pathname;
  } catch {
    return url;
  }
}
const indexed = computed(() => {
  const result = new Map();
  for (const [values, kind] of [
    [props.document.tiles || [], "Плитка"],
    [props.document.objects || [], "Объект"],
  ])
    for (const entry of values) {
      if (!result.has(entry.modelId)) result.set(entry.modelId, []);
      result.get(entry.modelId).push({ ...entry, kind });
    }
  return result;
});
function affected(issue) {
  const ids =
    issue.modelIds ||
    (issue.modelId
      ? [issue.modelId]
      : issue.stage === "catalogue"
        ? [...indexed.value.keys()]
        : []);
  return ids.flatMap((id) => indexed.value.get(id) || []);
}
</script>
<style scoped>
.map-loading-errors {
  display: flex;
  flex-direction: column;
  gap: 22px;
}
.map-loading-errors section {
  overflow-wrap: anywhere;
}
.map-loading-errors h3 {
  font-size: 16px;
  margin: 0 0 10px;
}
.map-loading-errors p {
  margin: 8px 0;
}
.map-loading-errors dl {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 6px 16px;
  font-size: 13px;
}
.map-loading-errors dt {
  color: var(--text-muted);
}
.map-loading-errors dd {
  margin: 0;
}
.map-loading-errors ul {
  padding-left: 20px;
  font-size: 12px;
}
</style>
