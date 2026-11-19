<template>
  <div class="red-stack">
    <RedCreationIntro title="Магазин" :cover="cover" />
    <WizardShop :items="available" :categories="categories" :category-of="categoryOf" item-key="key">
      <template #item="{ item }">
        <div class="red-row shop-entry">
          <WizardShopItemIcon :item="item" :size="36" :fallback="labels[item.kind]?.[1]" />
          <span>{{ item.name }}<small>{{ item.facts.price }} eb<template v-if="item.facts.quantity > 1"> / {{ item.facts.quantity }} шт.</template></small></span>
          <ActionButton :aria-label="'Добавить ' + item.name" @click="add(item)">+</ActionButton>
        </div>
      </template>
      <template #budget>
        <WizardSectionPanel class="shopping-panel">
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
        </WizardSectionPanel>
      </template>
      <template #cart>
        <WizardSectionPanel class="shopping-panel">
          <h3>Корзина</h3>
          <p v-if="!draft.cart.length">Покупок пока нет.</p>
          <div v-for="entry in draft.cart" :key="entry.uid" class="red-list-item">
            <div class="red-row">
              <WizardShopItemIcon :item="byKey[entry.key] || entry" :size="32" :fallback="labels[byKey[entry.key]?.kind]?.[1]" />
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
            /><FormField v-if="byKey[entry.key]?.kind === 'cyberware'" label="Расположение" vertical
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
        </WizardSectionPanel>
      </template>
      <template #extras>
        <WizardSectionPanel v-if="draft.method !== 'complete'" class="shopping-panel">
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
        </WizardSectionPanel>
      </template>
    </WizardShop>
  </div>
</template>
<script setup>
import { computed } from "vue";
import {
  ActionButton,
  FormField,
  FormSelect,
  FormNumberInput,
} from "@sylvieshare/share-ui";
import WizardSectionPanel from "@/shared/ui/WizardSectionPanel.vue";
import RedCreationIntro from "./RedCreationIntro.vue";
import WizardShop from "../WizardShop.vue";
import WizardShopItemIcon from "../WizardShopItemIcon.vue";
import { Backpack, Cpu, Shield, Crosshair, Shirt, Car, Pill, Package } from "@lucide/vue";
import {
  RED_STARTING_KITS,
  redKitRows,
} from "@/features/character-editor/settings/cyberpunk-red/startingKits";
import { redFashionEligible } from "@/features/character-editor/settings/cyberpunk-red/equipment";
const props = defineProps({
  draft: Object,
  items: Array,
  summary: Object,
  cover: String,
});
const emit = defineEmits(["patch"]);
const byKey = computed(() => Object.fromEntries(props.items.map(item => [item.key, item])));
const categoryOf = item => item.kind;
const labels = {
  gear: ["Снаряжение", Backpack], cyberware: ["Киберимпланты", Cpu],
  weapon: ["Оружие", Crosshair], ammo: ["Боеприпасы", Crosshair], armor: ["Броня", Shield],
  clothing: ["Одежда", Shirt], vehicle: ["Транспорт", Car], drug: ["Препараты", Pill],
  pharmaceutical: ["Фармацевтика", Pill], cyberdeck: ["Кибердеки", Cpu],
  program: ["Программы", Cpu], blackIce: ["Чёрный ЛЁД", Cpu], demon: ["Демоны", Cpu],
  itemUpgrade: ["Модификации", Package], housing: ["Жильё", Package], lifestyle: ["Образ жизни", Package],
};
const available = computed(() => props.items.filter(item =>
  !["criticalInjury", "role", "skill"].includes(item.kind) && item.facts.price > 0));
const categories = computed(() => [...new Set([...Object.keys(labels), ...available.value.map(categoryOf)])].map(id => ({
  id, label: labels[id]?.[0] || id, icon: labels[id]?.[1] || Package,
})));
const choices = computed(() => RED_STARTING_KITS[props.draft.role].filter(row => row.choice));
const giftRows = computed(() => {
  try {
    return redKitRows(props.draft.role, props.draft.kitChoices);
  } catch {
    return [];
  }
});
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

<style scoped>
.shop-entry { padding: var(--spacing-small); background: var(--surface); border-radius: var(--r-md); }
.shop-entry span { flex: 1; }
.shop-entry small { display: block; color: var(--text-muted); }
.shopping-panel h3, .shopping-panel p { margin: 0; }
.shopping-panel h3 { font-size: var(--type-row-size); }
.shopping-panel small { display: block; color: var(--text-muted); }
</style>
