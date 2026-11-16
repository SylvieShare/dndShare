<template>
  <section class="red-item-detail">
    <RichContent :html="item.data.description || ''" />
    <p v-if="purchasable && facts.price != null">
      <strong>{{ facts.price }} eb</strong
      ><span v-if="facts.quantity > 1"> за {{ facts.quantity }} шт.</span>
    </p>
    <dl>
      <template v-for="field in fields" :key="field.key"
        ><dt>{{ field.name }}</dt>
        <dd v-if="field.key === 'bonuses'">
          <div
            v-for="bonus in facts.bonuses"
            :key="bonus.target + (bonus.phase || '')"
          >
            {{ bonusName(bonus.target) }} {{ bonus.value >= 0 ? "+" : ""
            }}{{ bonus.value }}{{ bonus.conditional ? " · по условию" : ""
            }}{{
              bonus.phase === "primary"
                ? " · основной эффект"
                : bonus.phase === "secondary"
                  ? " · зависимость"
                  : ""
            }}
          </div>
        </dd>
        <dd v-else>{{ format(field, facts[field.key]) }}</dd></template
      >
    </dl>
  </section>
</template>
<script setup>
import { computed } from "vue";
import RichContent from "@/shared/ui/DndRichContent.vue";
import {
  RED_SKILLS_BY_KEY,
  RED_STATS,
} from "@/features/character-editor/settings/cyberpunk-red/catalogue";
const props = defineProps({ item: Object, type: Object });
const facts = computed(() => props.item.data.facts || {});
const purchasable = computed(
  () => !["role", "criticalInjury"].includes(props.item.data.red_kind),
);
const fields = computed(() =>
  (props.type?.fields?.find((f) => f.key === "facts")?.fields || []).filter(
    (f) =>
      !["price", "quantity"].includes(f.key) &&
      facts.value[f.key] != null &&
      facts.value[f.key] !== false &&
      facts.value[f.key] !== "" &&
      (!Array.isArray(facts.value[f.key]) || facts.value[f.key].length),
  ),
);
const labels = {
  standard: "Обычное",
  poor: "Низкое",
  excellent: "Высокое",
  head: "Голова",
  body: "Тело",
  mall: "Торговый центр",
  clinic: "Клиника",
  hospital: "Госпиталь",
  fashionware: "Стилевые",
  cyberwareInternal: "Внутренние",
  cyberwareExternal: "Внешние",
  neuralWare: "Нейроимпланты",
  cyberEye: "Кибероптика",
  cyberAudioSuite: "Кибераудио",
  cyberArm: "Киберрука",
  cyberLeg: "Кибернога",
  borgware: "Боргирование",
  booster: "Усиление",
  defender: "Защита",
  attacker: "Атака",
};
function format(field, value) {
  const key = field.key;
  if (field.options)
    return field.options.find((o) => o.value === value)?.label || value;
  if (key === "skill") return RED_SKILLS_BY_KEY[value]?.name || value;
  if (typeof value === "boolean") return value ? "Да" : "Нет";
  if (Array.isArray(value)) return value.map((v) => labels[v] || v).join(", ");
  return labels[value] || value;
}
function bonusName(key) {
  return (
    RED_SKILLS_BY_KEY[key]?.name ||
    RED_STATS.find((s) => "stat:" + s.key === key)?.name ||
    {
      initiative: "Инициатива",
      ranged: "Стрельба",
      melee: "Ближний бой",
      "all-actions": "Все действия",
      "perception-hearing": "Восприятие на слух",
      "perception-sight": "Зрительное восприятие",
      "pain-suppression": "Подавление боли",
      aimed: "Прицельная атака",
    }[key] ||
    key
  );
}
</script>
<style scoped>
.red-item-detail {
  display: grid;
  gap: var(--spacing-large);
  color: var(--text-1);
}
.red-item-detail dl {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--spacing-small) var(--spacing-large);
}
.red-item-detail dt {
  color: var(--text-muted);
}
.red-item-detail dd {
  margin: 0;
  overflow-wrap: anywhere;
}
</style>
