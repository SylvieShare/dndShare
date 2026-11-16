<template>
  <AppModal @close="emit('close')"
    ><div class="red-panel">
      <h2>Получение урона</h2>
      <FormField label="Урон до брони" vertical
        ><FormNumberInput
          :value="damage"
          :min="0"
          :max="10000"
          @change="damage = $event" /></FormField
      ><FormField label="Локализация" vertical
        ><FormSelect v-model:value="location"
          ><option value="body">Тело</option>
          <option value="head">Голова · ×2 после брони</option></FormSelect
        ></FormField
      ><FormField label="Броня" vertical
        ><FormSelect v-model:value="armorMode"
          ><option value="full">Полный SP</option>
          <option value="half">Половина SP · округление вверх</option>
          <option value="ignore">Обход брони</option></FormSelect
        ></FormField
      ><FormField label="Критическая травма" vertical
        ><FormSelect v-model:value="critical"
          ><option :value="false">Нет</option>
          <option :value="true">Да · +5 HP в обход брони</option></FormSelect
        ></FormField
      ><FormField label="Износ брони при пробитии" vertical
        ><FormNumberInput
          :value="ablation"
          :min="0"
          :max="10"
          @change="ablation = $event"
      /></FormField>
      <FormField label="Нелетальный урон" vertical
        ><FormSelect v-model:value="nonlethal"
          ><option :value="false">Обычный</option>
          <option :value="true">
            Оглушение · минимум 1 HP, без износа и травмы
          </option></FormSelect
        ></FormField
      >
      <div v-if="preview">
        <p>
          Броня: {{ preview.protection }} · Потеря HP: {{ preview.hpLoss }} ·
          Износ SP: {{ preview.ablation }}
        </p>
        <strong
          >{{ values.health.current }} →
          {{ preview.next.health.current }} HP</strong
        >
        <p v-if="preview.critical">
          После применения выберите критическую травму в разделе здоровья.
        </p>
      </div>
      <ActionButton
        :disabled="!preview"
        @click="
          emit('apply', preview.next);
          emit('close');
        "
        >Применить</ActionButton
      >
    </div></AppModal
  >
</template>
<script setup>
import { computed, ref } from "vue";
import {
  AppModal,
  ActionButton,
  FormField,
  FormSelect,
  FormNumberInput,
} from "@sylvieshare/share-ui";
import { redDamage } from "../../../settings/cyberpunk-red/gameplay";
const props = defineProps({ values: Object, items: Array });
const emit = defineEmits(["apply", "close"]);
const damage = ref(0),
  location = ref("body"),
  armorMode = ref("full"),
  critical = ref(false),
  nonlethal = ref(false),
  ablation = ref(1);
const preview = computed(() => {
  try {
    return redDamage(props.values, props.items, {
      damage: damage.value,
      location: location.value,
      armorMode: armorMode.value,
      critical: critical.value,
      nonlethal: nonlethal.value,
      ablation: ablation.value,
    });
  } catch {
    return null;
  }
});
</script>
