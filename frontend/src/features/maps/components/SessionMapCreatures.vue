<template>
  <section class="map-creatures" aria-label="Существа сессии">
    <FormTextInput
      v-model:value="query"
      aria-label="Найти существо"
      placeholder="Найти игрока или существо…"
    />
    <template v-for="group in groups" :key="group.kind">
      <SectionLabel :title="group.label" :count="group.items.length" />
      <p v-if="!group.items.length" class="map-hint">{{ group.empty }}</p>
      <MapEntityRow
        v-for="item in group.items"
        :key="creatureKey(item)"
        :entry="item"
        :selected="selected === creatureKey(item)"
        @select="emit('focus', item)"
      >
        <template #details>
          <SessionHpBar v-if="item.hp" :hp="item.hp" />
          <small v-else class="map-hint">Хиты не указаны</small>
        </template>
        <template #actions>
          <ActionButton
            icon-only
            variant="quiet"
            :aria-label="
              onMap(item)
                ? `Найти на карте: ${item.name}`
                : `Поставить на карту: ${item.name}`
            "
            @click.stop="
              onMap(item) ? emit('focus', item) : emit('place', item)
            "
          >
            <template #icon
              ><Focus v-if="onMap(item)" :size="18" /><Plus v-else :size="18"
            /></template>
          </ActionButton>
        </template>
      </MapEntityRow>
    </template>
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
import {
  ActionButton,
  FormTextInput,
  SectionLabel,
} from "@sylvieshare/share-ui";
import { Focus, Plus, MapPin } from "@lucide/vue";
import SessionHpBar from "@/features/sessions/components/SessionHpBar.vue";
import MapEntityRow from "./MapEntityRow.vue";
import { creatureKey, creatureToken } from "../lib/sessionCreatures";
const props = defineProps({
  editor: Object,
  candidates: Array,
  selected: String,
});
const emit = defineEmits(["focus", "place"]),
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
  gap: 10px;
}
</style>
