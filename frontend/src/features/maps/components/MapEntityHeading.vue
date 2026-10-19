<template>
  <header class="map-selected-heading">
    <component
      :is="icon"
      :size="20"
      class="map-entity-type"
      :style="{ color: entry.color || 'var(--text-muted)' }"
      aria-hidden="true"
    />
    <h3 :aria-label="entry.name">
      <InlineEdit
        v-if="editable"
        :model-value="entry.item.name"
        :display-value="entry.name"
        :label="nameLabel"
        :edit-label="`Изменить ${nameLabel.toLowerCase()}`"
        confirm-label="Сохранить название"
        cancel-label="Отменить изменение названия"
        required
        :maxlength="100"
        @confirm="emit('rename', String($event).trim())"
      >
        <span v-if="entry.namePrefix" class="map-entity-prefix"
          >{{ entry.namePrefix }} · </span
        >{{ entry.item.name }}
      </InlineEdit>
      <template v-else
        ><span v-if="entry.namePrefix" class="map-entity-prefix"
          >{{ entry.namePrefix }} · </span
        >{{ entry.namePrefix ? entry.item.name : entry.name }}</template
      >
    </h3>
    <small v-if="showIdentifiers && entry.code"
      >{{ entry.groupCode }} · {{ entry.code }}</small
    >
  </header>
</template>
<script setup>
import { computed } from "vue";
import { InlineEdit } from "@sylvieshare/share-ui";
import {
  Box,
  Group,
  Layers,
  Lightbulb,
  MapPin,
  Skull,
  UserRound,
} from "@lucide/vue";
const props = defineProps({
  entry: Object,
  editable: Boolean,
  showIdentifiers: Boolean,
});
const emit = defineEmits(["rename"]);
const icon = computed(
  () =>
    ({
      tile: Layers,
      object: Box,
      light: Lightbulb,
      area: Group,
      group: Layers,
      player: UserRound,
      creature: Skull,
      marker: MapPin,
    })[props.entry.kind] || Box,
);
const nameLabel = computed(() =>
  props.entry.kind === "area" ? "Название области" : "Название источника света",
);
</script>
<style scoped>
.map-selected-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.map-entity-type {
  flex: none;
}
h3 {
  margin: 0;
  font-size: 18px;
  min-width: 0;
  max-width: calc(100% - 28px);
  overflow-wrap: anywhere;
  --inline-edit-min-width: 0;
  --inline-edit-height: 30px;
}
small {
  font: 11px var(--font-mono);
  color: var(--text-muted);
  overflow-wrap: anywhere;
}
.map-entity-prefix {
  color: var(--text-muted);
}
</style>
