<template>
  <section class="map-creatures" aria-label="Существа сессии">
    <FormTextInput
      v-model:value="query"
      aria-label="Найти существо"
      placeholder="Найти игрока или существо…"
    />
    <section
      v-for="group in groups"
      :key="group.kind"
      class="map-creature-group"
    >
      <MapPanelHeading :title="group.label" :count="group.items.length" />
      <div class="map-creature-list">
        <p v-if="!group.items.length" class="map-hint">{{ group.empty }}</p>
        <MapEntityRow
          v-for="item in group.items"
          :key="creatureKey(item)"
          :entry="item"
          :selected="!!onMap(item) && selected === creatureKey(item)"
          :placed="!!onMap(item)"
          :activate-on-click="false"
          class="map-creature-draggable"
          @pointerdown="(event) => emit('drag', item, event)"
          @dragstart.prevent
          @select="emit('focus', item)"
        >
          <template #details>
            <SessionHpBar v-if="item.hp" :hp="item.hp" />
            <small v-else class="map-hint">Хиты не указаны</small>
          </template>
        </MapEntityRow>
      </div>
    </section>
    <ActionButton
      variant="quiet"
      @click="
        emit('place', {
          kind: 'marker',
          ref: '',
          name: 'Метка',
          color: '#d4ae69',
        })
      "
      ><template #icon><MapPin :size="18" /></template>Добавить
      метку</ActionButton
    >
  </section>
</template>
<script setup>
import { computed, ref } from "vue";
import { ActionButton, FormTextInput } from "@sylvieshare/share-ui";
import { MapPin } from "@lucide/vue";
import SessionHpBar from "@/features/sessions/components/SessionHpBar.vue";
import MapPanelHeading from "./MapPanelHeading.vue";
import MapEntityRow from "./MapEntityRow.vue";
import { creatureKey, creatureToken } from "../lib/sessionCreatures";
const props = defineProps({
  editor: Object,
  candidates: Array,
  selected: String,
});
const emit = defineEmits(["focus", "place", "drag"]),
  query = ref("");
const filtered = computed(() =>
  props.candidates.filter((c) =>
    c.name.toLocaleLowerCase().includes(query.value.toLocaleLowerCase()),
  ),
);
const groups = computed(() => [
  {
    kind: "player",
    label: "Игроки",
    empty: "В сессии пока нет игроков",
    items: filtered.value.filter((c) => c.kind === "player"),
  },
  {
    kind: "creature",
    label: "Существа",
    empty: "В бою и резерве пока нет существ",
    items: filtered.value.filter((c) => c.kind === "creature"),
  },
  ...((props.editor.draft.state.tokens || []).some((t) => t.kind === "marker")
    ? [
        {
          kind: "marker",
          label: "Метки",
          items: props.editor.draft.state.tokens
            .filter((t) => t.kind === "marker")
            .map((t) => ({ ...t, previewUrl: t.imageUrl })),
          empty: "",
        },
      ]
    : []),
]);
const onMap = (c) => creatureToken(props.editor.draft, c);
</script>
<style scoped>
.map-creatures {
  display: flex;
  flex-direction: column;
  gap: 25px;
}
.map-creature-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.map-creature-draggable {
  cursor: grab;
  touch-action: none;
}
.map-creature-draggable:active {
  cursor: grabbing;
}
</style>
