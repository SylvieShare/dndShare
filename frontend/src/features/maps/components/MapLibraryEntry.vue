<template>
  <BaseTile
    class="map-library-entry"
    :class="{ 'map-library-entry--list': layout === 'list' }"
    padding="12px"
  >
    <button
      type="button"
      class="map-entry-preview"
      :aria-label="`${picker && usable ? 'Выбрать' : 'Открыть'} карту ${map.name}`"
      @click="emit('open', map)"
    >
      <MapThumbnail :map="map" :height="layout === 'list' ? 112 : 190" />
    </button>
    <div class="map-entry-content">
      <div class="map-entry-heading">
        <button type="button" class="map-entry-name" @click="emit('open', map)">
          {{ map.name }}</button
        ><span class="map-entry-status"
          ><component :is="LockKeyhole" v-if="map.publishedAt" :size="12" />{{
            map.publishedAt ? "Опубликована" : "Черновик"
          }}</span
        >
      </div>
      <span class="map-entry-author">{{ map.author }}</span>
      <span class="map-entry-meta"
        >{{ map.width }} × {{ map.height }} клеток ·
        {{ map.tileCount }} плиток<span v-if="map.objectCount">
          · {{ map.objectCount }} объектов</span
        ></span
      >
      <div class="map-entry-tags" aria-label="Теги карты">
        <span v-for="tag in map.tags" :key="tag">{{ tag }}</span>
      </div>
      <MapRating
        v-if="map.publishedAt"
        :model-value="map.myRating"
        :rating="map.rating"
        :count="map.ratingCount"
        :editable="!map.owned"
        :busy="busy"
        @rate="emit('rate', map, $event)"
      />
    </div>
    <div class="map-entry-actions">
      <ActionButton
        v-if="!map.owned && map.publishedAt"
        :variant="map.subscribed ? 'secondary' : 'primary'"
        :disabled="busy"
        @click="emit('subscribe', map)"
        ><template #icon
          ><component
            :is="map.subscribed ? BookmarkCheck : BookmarkPlus"
            :size="16" /></template
        >{{ map.subscribed ? "Отписаться" : "Подписаться" }}</ActionButton
      >
      <ActionButton
        v-if="picker && usable"
        variant="secondary"
        :disabled="busy"
        @click="emit('select', map)"
        >Выбрать</ActionButton
      >
      <template v-if="!picker">
        <ActionButton
          v-if="map.owned && !map.publishedAt"
          variant="secondary"
          :disabled="busy"
          @click="emit('publish', map)"
          ><template #icon><Globe :size="16" /></template
          >Опубликовать</ActionButton
        >
        <ActionButton
          v-if="usable"
          icon-only
          variant="quiet"
          aria-label="Создать копию карты"
          title="Создать личную копию"
          :disabled="busy"
          @click="emit('copy', map)"
          ><template #icon><Copy :size="16" /></template
        ></ActionButton>
        <ActionButton
          v-if="map.owned && !map.publishedAt"
          icon-only
          variant="quiet"
          aria-label="Удалить карту"
          title="Удалить карту"
          class="map-entry-delete"
          :disabled="busy"
          @click="emit('delete', map)"
          ><template #icon><Trash2 :size="16" /></template
        ></ActionButton>
      </template>
    </div>
  </BaseTile>
</template>
<script setup>
import { computed } from "vue";
import { ActionButton, BaseTile } from "@sylvieshare/share-ui";
import {
  BookmarkCheck,
  BookmarkPlus,
  Copy,
  Globe,
  LockKeyhole,
  Trash2,
} from "@lucide/vue";
import MapThumbnail from "./MapThumbnail.vue";
import MapRating from "./MapRating.vue";
const props = defineProps({
  map: Object,
  layout: String,
  picker: Boolean,
  busy: Boolean,
});
const usable = computed(() => props.map.owned || props.map.subscribed);
const emit = defineEmits([
  "open",
  "select",
  "copy",
  "delete",
  "publish",
  "subscribe",
  "rate",
]);
</script>
<style scoped>
.map-library-entry {
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 14px;
  min-width: 0;
}
.map-entry-preview,
.map-entry-name {
  border: 0;
  background: none;
  color: inherit;
  padding: 0;
  text-align: left;
  cursor: pointer;
}
.map-entry-preview {
  min-width: 0;
  overflow: hidden;
  border-radius: 9px;
}
.map-entry-name {
  font: 20px var(--font-display);
  color: var(--text-1);
  overflow-wrap: anywhere;
  transition: color 160ms ease;
}
.map-entry-name:hover {
  color: var(--accent);
}
.map-entry-heading {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 10px;
}
.map-entry-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--text-muted);
  font-size: 10px;
}
.map-entry-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.map-entry-author,
.map-entry-meta {
  color: var(--text-muted);
  font-size: 12px;
}
.map-entry-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 11px;
  color: var(--text-muted);
}
.map-entry-tags span {
  padding: 3px 7px;
  border-radius: 5px;
  background: var(--bg);
}
.map-entry-actions {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.map-entry-delete {
  color: var(--danger);
}
.map-library-entry--list {
  grid-template-columns: 180px minmax(0, 1fr) auto;
  grid-template-rows: auto;
  align-items: center;
}
.map-library-entry--list .map-entry-actions {
  justify-content: flex-end;
  max-width: 280px;
}
@media (max-width: 760px) {
  .map-library-entry--list {
    grid-template-columns: 100px minmax(0, 1fr);
    align-items: start;
  }
  .map-library-entry--list .map-entry-actions {
    grid-column: 1/-1;
    max-width: none;
    justify-content: flex-start;
  }
  .map-entry-name {
    font-size: 18px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .map-entry-name {
    transition: none;
  }
}
</style>
