<template>
  <BaseTile :outlined="false"
    ><div class="red-panel red-resources">
      <h2>Состояние</h2>
      <p v-if="values.health.dead" role="status" class="red-danger">
        Персонаж погиб
      </p>
      <ActionButton
        v-if="editable && values.health.dead"
        @click="set('health', 'dead', false)"
        >Исправить отметку смерти</ActionButton
      >
      <FormField label="Здоровье" vertical
        ><FormNumberInput
          v-if="editable"
          :value="values.health.current"
          :min="0"
          :max="maximum"
          @change="set('health', 'current', $event)"
        /><strong v-else>{{ values.health.current }}</strong
        ><small
          >из {{ maximum }} · {{ woundNames[wound.state] }}</small
        ></FormField
      >
      <p v-if="wound.state === 'serious'">−2 к действиям</p>
      <p v-if="wound.state === 'mortal'" class="red-danger">
        −4 к действиям · проверка смерти
      </p>
      <FormField label="Человечность" vertical
        ><FormNumberInput
          v-if="editable"
          :value="values.humanity.current"
          :max="humanity.maximum"
          @change="set('humanity', 'current', $event)"
        /><strong v-else>{{ values.humanity.current }}</strong
        ><small
          >Максимум {{ humanity.maximum }} · EMP {{ humanity.empathy }}</small
        ></FormField
      >
      <p v-if="humanity.cyberpsychosis" class="red-danger">
        Киберпсихоз · решение ведущего
      </p>
      <FormField label="Удача" vertical
        ><FormNumberInput
          v-if="editable"
          :value="values.luck.current"
          :min="0"
          :max="values.stats.LUCK"
          @change="set('luck', 'current', $event)"
        /><strong v-else
          >{{ values.luck.current }} / {{ values.stats.LUCK }}</strong
        ></FormField
      >
      <div class="red-actions">
        <ActionButton v-if="editable" @click="emit('action', 'new-session')"
          >Новая сессия</ActionButton
        ><ActionButton
          @click="emit('roll', { kind: 'initiative', title: 'Инициатива' })"
          >Инициатива</ActionButton
        ><ActionButton
          v-if="wound.state === 'mortal' && !values.health.dead"
          @click="emit('roll', { kind: 'death', title: 'Проверка смерти' })"
          >Проверка смерти</ActionButton
        >
      </div>
    </div></BaseTile
  >
</template>
<script setup>
import { computed } from "vue";
import {
  BaseTile,
  FormField,
  FormNumberInput,
  ActionButton,
} from "@sylvieshare/share-ui";
import {
  redWoundState,
  redHumanity,
} from "../../../settings/cyberpunk-red/derived";
import { redMaximumHealth } from "../../../settings/cyberpunk-red/equipment";
const props = defineProps({ values: Object, items: Array, editable: Boolean });
const emit = defineEmits(["patch", "roll", "action"]);
const maximum = computed(() => redMaximumHealth(props.values, props.items));
const wound = computed(() =>
  redWoundState(props.values.health.current, maximum.value),
);
const humanity = computed(() =>
  redHumanity({
    baseEmpathy: props.values.stats.EMP,
    current: props.values.humanity.current,
    maximumLoss: (props.values.cyberware?.installations || []).reduce(
      (n, e) => {
        const f = props.items.find((i) => i.key === e.key)?.facts;
        return (
          n + (f?.humanity > 0 ? (f.cyberCategory === "borgware" ? 4 : 2) : 0)
        );
      },
      0,
    ),
  }),
);
const woundNames = {
  healthy: "без ранений",
  light: "лёгкое ранение",
  serious: "тяжёлое ранение",
  mortal: "смертельное ранение",
};
function set(block, key, value) {
  emit("patch", { [block]: { ...props.values[block], [key]: value } });
}
</script>
