<template>
  <AppModalFrame
    :title="
      mode === 'library'
        ? 'Добавить 3D карту'
        : mode === 'image'
          ? 'Добавить 2D карту'
          : 'Карты сессии'
    "
    :width="1100"
    close-label="Закрыть выбор карты"
    @close="emit('close')"
  >
    <div class="session-map-picker-actions">
      <ActionButton
        v-if="mode !== 'session'"
        variant="quiet"
        @click="mode = 'session'"
        ><template #icon><ArrowLeft :size="16" /></template>Карты
        сессии</ActionButton
      >
      <template v-else
        ><ActionButton variant="secondary" @click="mode = 'library'"
          ><template #icon><Plus :size="16" /></template>Добавить новую 3D
          карту</ActionButton
        ><ActionButton variant="secondary" @click="mode = 'image'"
          ><template #icon><Image :size="16" /></template>Добавить 2D
          карту</ActionButton
        ></template
      >
    </div>
    <MapLibrary
      v-if="mode === 'library'"
      picker
      @select="emit('add', $event)"
    />
    <SessionMapImageForm
      v-else-if="mode === 'image'"
      :uuid="uuid"
      @created="emit('created', $event)"
    />
    <div v-else class="session-map-choices">
      <BaseTile
        v-for="map in maps"
        :key="map.id"
        framed
        class="session-map-choice"
        :tint="map.id === selected"
      >
        <button
          type="button"
          class="session-map-choice-main"
          @click="emit('select', map.id)"
        >
          <MapEntityRow
            :entry="{ kind: 'map', name: map.name }"
            :selectable="false"
          /><small class="map-hint"
            >{{ map.document.kind === "image" ? "2D карта" : "3D карта"
            }}<template v-if="map.source?.name">
              · {{ map.source.name }}</template
            ></small
          >
        </button>
        <RemoveButton
          icon="trash"
          :label="`Убрать карту ${map.name}`"
          @click="emit('remove', map)"
        />
      </BaseTile>
      <p v-if="!maps.length" class="map-hint">В сессии пока нет карт.</p>
    </div>
  </AppModalFrame>
</template>
<script setup>
import { ref } from "vue";
import {
  ActionButton,
  AppModalFrame,
  BaseTile,
  RemoveButton,
} from "@sylvieshare/share-ui";
import { ArrowLeft, Image, Plus } from "@lucide/vue";
import MapLibrary from "./MapLibrary.vue";
import MapEntityRow from "./MapEntityRow.vue";
import SessionMapImageForm from "./SessionMapImageForm.vue";
defineProps({ uuid: String, maps: Array, selected: String });
const emit = defineEmits(["close", "add", "created", "select", "remove"]);
const mode = ref("session");
</script>
<style scoped>
.session-map-picker-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}
.session-map-choices {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
}
.session-map-choice {
  display: flex;
  align-items: center;
  padding: 12px;
  gap: 8px;
}
.session-map-choice-main {
  flex: 1;
  min-width: 0;
  border: 0;
  background: none;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.session-map-choice-main:focus-visible {
  outline: 2px solid var(--accent);
  border-radius: 8px;
}
</style>
