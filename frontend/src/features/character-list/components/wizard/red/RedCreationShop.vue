<template>
  <div class="red-stack">
    <RedCreationIntro :title="cyber ? 'Киберимпланты' : 'Снаряжение'" :cover="cover" />
    <BaseTile :outlined="false"
      ><div class="red-panel">
        <div class="red-two">
          <div>
            <small>Основной бюджет</small
            ><strong
              >{{ summary.generalLimit - summary.general }} /
              {{ summary.generalLimit }} eb</strong
            >
          </div>
          <div v-if="draft.method === 'complete'">
            <small>Одежда и fashionware</small
            ><strong
              >{{ summary.fashionLimit - summary.fashion }} /
              {{ summary.fashionLimit }} eb</strong
            >
          </div>
        </div>
        <p v-for="error in summary.errors" :key="error" class="red-danger">
          {{ error }}
        </p>
        <ActionButton @click="picker = true"
          >Выбрать из справочника</ActionButton
        >
      </div></BaseTile
    >
    <BaseTile v-if="draft.method !== 'complete'" :outlined="false"
      ><div class="red-panel">
        <h3>Комплект роли</h3>
        <div v-for="choice in choices" :key="choice.choice">
          <FormField label="Выбор в комплекте" vertical
            ><FormSelect
              :value="draft.kitChoices[choice.choice]"
              @update:value="
                emit('patch', {
                  kitChoices: {
                    ...draft.kitChoices,
                    [choice.choice]: Number($event),
                  },
                })
              "
              ><option
                v-for="(option, i) in choice.options"
                :key="i"
                :value="i"
              >
                {{ option.map((e) => byKey[e.key]?.name || e.key).join(" + ") }}
              </option></FormSelect
            ></FormField
          >
        </div>
        <div v-for="(row, i) in giftRows" :key="i" class="red-row">
          <span>{{ byKey[row.key]?.name || row.key }}</span
          ><strong>×{{ row.count }}</strong>
        </div>
        <small>Выданное комплектом не уменьшает дополнительные 500 eb.</small>
      </div></BaseTile
    >
    <BaseTile :outlined="false"
      ><div class="red-panel">
        <h3>Корзина</h3>
        <p v-if="!cart.length">Покупок пока нет.</p>
        <div v-for="entry in cart" :key="entry.uid" class="red-list-item">
          <div class="red-row">
            <div>
              {{ byKey[entry.key]?.name
              }}<small>{{
                entry.pool === "fashion" ? "Одежда" : "Основной бюджет"
              }}</small>
            </div>
            <ActionButton
              variant="quiet"
              @click="
                emit('patch', {
                  cart: draft.cart.filter((e) => e.uid !== entry.uid),
                })
              "
              >Убрать</ActionButton
            >
          </div>
          <FormNumberInput
            :value="entry.count"
            :min="1"
            :max="9999"
            @change="changeCount(entry, $event)"
          /><FormField v-if="cyber" label="Расположение" vertical
            ><FormSelect
              :value="entry.location || ''"
              @update:value="changeLocation(entry, $event)"
              ><option value="">Определить автоматически</option>
              <option value="body">Тело</option>
              <option value="left-eye">Левый глаз</option>
              <option value="right-eye">Правый глаз</option>
              <option value="flesh-arm-left">Левая рука</option>
              <option value="flesh-arm-right">Правая рука</option>
              <option value="flesh-leg-left">Левая нога</option>
              <option value="flesh-leg-right">Правая нога</option></FormSelect
            ></FormField
          ><FormSelect
            v-if="
              draft.method === 'complete' && fashionEligible(byKey[entry.key])
            "
            :value="entry.pool"
            @update:value="changePool(entry, $event)"
            ><option value="general">Основной бюджет</option>
            <option value="fashion">Бюджет одежды</option></FormSelect
          >
        </div>
      </div></BaseTile
    >
    <RedItemPicker
      v-if="picker"
      :items="available"
      title="Покупки при создании"
      @select="add"
      @close="picker = false"
    />
  </div>
</template>
<script setup>
import { computed, ref } from "vue";
import {
  BaseTile,
  ActionButton,
  FormField,
  FormSelect,
  FormNumberInput,
} from "@sylvieshare/share-ui";
import RedCreationIntro from "./RedCreationIntro.vue";
import RedItemPicker from "@/features/character-editor/components/sheet/cyberpunk-red/RedItemPicker.vue";
import {
  RED_STARTING_KITS,
  redKitRows,
} from "@/features/character-editor/settings/cyberpunk-red/startingKits";
import { redFashionEligible } from "@/features/character-editor/settings/cyberpunk-red/equipment";
const props = defineProps({
  draft: Object,
  items: Array,
  summary: Object,
  cyber: Boolean,
  cover: String,
});
const emit = defineEmits(["patch"]);
const picker = ref(false),
  byKey = computed(() =>
    Object.fromEntries(props.items.map((i) => [i.key, i])),
  );
const available = computed(() =>
  props.items.filter(
    (i) =>
      (props.cyber
        ? i.kind === "cyberware"
        : !["cyberware", "criticalInjury", "role", "skill"].includes(i.kind)) &&
      i.facts.price > 0,
  ),
);
const choices = computed(() =>
  RED_STARTING_KITS[props.draft.role].filter(
    (r) =>
      r.choice &&
      r.options
        .flat()
        .some(
          (e) => (byKey.value[e.key]?.kind === "cyberware") === props.cyber,
        ),
  ),
);
const giftRows = computed(() => {
  try {
    return redKitRows(props.draft.role, props.draft.kitChoices).filter(
      (e) => (byKey.value[e.key]?.kind === "cyberware") === props.cyber,
    );
  } catch {
    return [];
  }
});
const cart = computed(() =>
  props.draft.cart.filter(
    (e) => (byKey.value[e.key]?.kind === "cyberware") === props.cyber,
  ),
);
const fashionEligible = (item) => item && redFashionEligible(item);
function add(item) {
  emit("patch", {
    cart: [
      ...props.draft.cart,
      {
        uid: crypto.randomUUID(),
        key: item.key,
        count: item.facts.quantity || 1,
        pool:
          props.draft.method === "complete" && fashionEligible(item)
            ? "fashion"
            : "general",
      },
    ],
  });
  picker.value = false;
}
function changeLocation(entry, location) {
  emit("patch", {
    cart: props.draft.cart.map((e) =>
      e.uid === entry.uid ? { ...e, location } : e,
    ),
  });
}
function changeCount(entry, count) {
  emit("patch", {
    cart: props.draft.cart.map((e) =>
      e.uid === entry.uid ? { ...e, count } : e,
    ),
  });
}
function changePool(entry, pool) {
  emit("patch", {
    cart: props.draft.cart.map((e) =>
      e.uid === entry.uid ? { ...e, pool } : e,
    ),
  });
}
</script>
