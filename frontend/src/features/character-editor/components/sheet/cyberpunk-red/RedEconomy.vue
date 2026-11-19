<template>
  <BaseTile :outlined="false"
    ><div class="red-panel">
      <h2>Расходы и доходы</h2>
      <p>Баланс: <EurodollarAmount :amount="values.economy.cashEb" /></p>
      <p v-if="error" class="red-danger" role="alert">{{ error }}</p>
      <FormField label="Жильё" vertical
        ><FormSelect
          :value="values.economy.housingKey"
          :disabled="!editable"
          @update:value="set('housingKey', $event)"
          ><option
            v-for="i in housing"
            :key="i.key"
            :value="i.key.replace('housing-', '')"
          >
            {{ i.name }} · {{ i.facts.rent }} €$/месяц
          </option></FormSelect
        ></FormField
      >
      <FormField label="Образ жизни" vertical
        ><FormSelect
          :value="values.economy.lifestyleKey"
          :disabled="!editable"
          @update:value="set('lifestyleKey', $event)"
          ><option
            v-for="i in lifestyle"
            :key="i.key"
            :value="i.key.replace('lifestyle-', '')"
          >
            {{ i.name }} · {{ i.facts.monthlyCost }} €$/месяц
          </option></FormSelect
        ></FormField
      >
      <ActionButton
        v-if="editable"
        @click="transaction(-monthly, 'Жильё и образ жизни')"
        >Оплатить следующий месяц · <EurodollarAmount :amount="monthly" /></ActionButton
      ><small
        >При создании первый месяц уже оплачен. Корпоративное жильё требует
        соответствующего положения; последствия задолженности определяет
        ведущий.</small
      >
      <div v-if="editable" class="red-section">
        <FormTextInput
          v-model:value="label"
          placeholder="Работа, продажа, лечение или иной расход"
        /><FormField label="Сумма в евродолларах: плюс доход, минус расход" vertical
          ><FormNumberInput
            :value="amount"
            :min="-100000000"
            :max="100000000"
            @change="amount = $event" /></FormField
        ><ActionButton
          :disabled="!label.trim() || !amount"
          @click="transaction(amount, label)"
          >Записать операцию</ActionButton
        >
      </div>
      <div
        v-for="row in (values.economy.ledger || []).slice(-15).reverse()"
        :key="row.uid"
        class="red-row"
      >
        <span>{{ row.name }}</span
        ><strong>{{ row.amount > 0 ? "+" : "" }}<EurodollarAmount :amount="row.amount" /></strong>
      </div>
    </div></BaseTile
  >
</template>
<script setup>
import EurodollarAmount from '@/shared/ui/EurodollarAmount.vue'
import { computed, ref } from "vue";
import {
  BaseTile,
  FormField,
  FormSelect,
  FormTextInput,
  FormNumberInput,
  ActionButton,
} from "@sylvieshare/share-ui";
const props = defineProps({ values: Object, items: Array, editable: Boolean }),
  emit = defineEmits(["patch"]);
const error = ref(""),
  label = ref(""),
  amount = ref(0),
  housing = computed(() => props.items.filter((i) => i.kind === "housing")),
  lifestyle = computed(() => props.items.filter((i) => i.kind === "lifestyle"));
const monthly = computed(
  () =>
    (housing.value.find(
      (i) => i.key === "housing-" + props.values.economy.housingKey,
    )?.facts.rent || 0) +
    (lifestyle.value.find(
      (i) => i.key === "lifestyle-" + props.values.economy.lifestyleKey,
    )?.facts.monthlyCost || 0),
);
function set(key, value) {
  emit("patch", { economy: { ...props.values.economy, [key]: value } });
}
function transaction(delta, name) {
  error.value = "";
  if (props.values.economy.cashEb + delta < 0) {
    error.value = "Не хватает евробаксов";
    return;
  }
  emit("patch", {
    economy: {
      ...props.values.economy,
      cashEb: props.values.economy.cashEb + delta,
      ledger: [
        ...(props.values.economy.ledger || []),
        {
          uid: crypto.randomUUID(),
          at: new Date().toISOString(),
          name,
          amount: delta,
        },
      ],
    },
  });
}
</script>
