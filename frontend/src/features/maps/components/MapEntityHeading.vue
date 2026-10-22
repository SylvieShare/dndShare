<template>
  <InspectorHeading
    :name="entry.name"
    :value="entry.item?.name"
    :prefix="entry.namePrefix"
    :icon="icon"
    :color="entry.color"
    :editable="editable"
    :label="nameLabel"
    @rename="emit('rename', $event)"
  >
    <template #before-name
      ><MapPackIcon
        v-if="entry.model?.collection"
        :pack="entry.model.collection"
        :size="28"
        aria-hidden="false"
        role="img"
        :aria-label="entry.model.collectionName"
        :title="entry.model.collectionName"
    /></template>
    <template #metadata
      ><small v-if="showIdentifiers && entry.code"
        >{{ entry.groupCode }} · {{ entry.code }}</small
      ></template
    >
  </InspectorHeading>
</template>
<script setup>
import { computed } from "vue";
import InspectorHeading from "@/shared/ui/InspectorHeading.vue";
import MapPackIcon from "./MapPackIcon.vue";
import {
  Box,
  Group,
  Layers,
  Lightbulb,
  MapPin,
  Skull,
  Sticker,
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
      decal: Sticker,
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
  props.entry.kind === "decal"
    ? "Название декали"
    : props.entry.kind === "area"
      ? "Название области"
      : "Название источника света",
);
</script>
<style scoped>
small {
  font: 11px var(--font-mono);
  color: var(--text-muted);
  overflow-wrap: anywhere;
}
</style>
