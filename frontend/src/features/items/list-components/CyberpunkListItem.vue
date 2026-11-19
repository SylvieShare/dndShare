<template>
  <ObjectListItem
    :item="item"
    :type="type"
    :name-en="item.nameEn || ''"
    :custom="item.userId != null"
    :subtitle="subtitle"
    ><template #icon-fallback
      ><component :is="icon" :size="30" aria-hidden="true" /></template
    ><template v-if="metric" #metric
      ><strong>{{ metric }}</strong></template
    ><template v-if="facts.price != null" #trailing
      ><span><EurodollarAmount :amount="facts.price" /></span></template
    ></ObjectListItem
  >
</template>
<script setup>
import EurodollarAmount from '@/shared/ui/EurodollarAmount.vue'
import { computed } from "vue";
import {
  Cpu,
  Crosshair,
  Shirt,
  TriangleAlert,
  Pill,
  Backpack,
  Monitor,
  Cog,
  Car,
  Swords,
  Users,
  Package,
  Shield,
} from "@lucide/vue";
import ObjectListItem from "./ObjectListItem.vue";
const props = defineProps({ item: Object, type: Object });
const facts = computed(() => props.item.data?.facts || {});
const kind = computed(() => props.item.data?.red_kind);
const icon = computed(
  () =>
    ({
      weapon: Swords,
      armor: Shield,
      cyberware: Cpu,
      ammo: Crosshair,
      clothing: Shirt,
      criticalInjury: TriangleAlert,
      drug: Pill,
      gear: Backpack,
      cyberdeck: Monitor,
      program: Monitor,
      itemUpgrade: Cog,
      vehicle: Car,
      role: Users,
    })[kind.value] || Package,
);
const metric = computed(
  () =>
    facts.value.damage ||
    facts.value.bodySP ||
    facts.value.headSP ||
    facts.value.rez ||
    "",
);
const subtitle = computed(() =>
  [
    facts.value.rof ? `ROF ${facts.value.rof}` : "",
    facts.value.magazine ? `Магазин ${facts.value.magazine}` : "",
    facts.value.slots ? `${facts.value.slots} слотов` : "",
    facts.value.humanity != null ? `Humanity −${facts.value.humanity}` : "",
    facts.value.quantity > 1 ? `${facts.value.quantity} шт.` : "",
  ]
    .filter(Boolean)
    .join(" · "),
);
</script>
