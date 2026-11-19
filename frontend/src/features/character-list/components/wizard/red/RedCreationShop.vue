<template>
  <div class="red-stack">
    <WizardShop :items="available" :categories="categories" :category-of="categoryOf" item-key="key" :cart-count="cartCount">
      <template #item="{ item }">
        <WizardShopOffer :item="item" :price="item.facts.price + ' €$'" :count="item.facts.quantity || 1"
          @buy="add(item)" @details="viewItem = item">
          <template #price><EurodollarAmount :amount="item.facts.price" /></template>
        </WizardShopOffer>
      </template>
      <template #budget>
        <div class="wealth-copy">
          <span class="wealth-kicker">Начальное богатство</span>
          <strong><EurodollarAmount :amount="summary.generalLimit" /></strong>
        </div>
        <div class="wealth-totals">
          <span><small>Потрачено</small><EurodollarAmount :amount="summary.general" /></span>
          <span class="remaining"><small>Останется в кошельке</small><EurodollarAmount :amount="summary.cash" /></span>
          <template v-if="draft.method === 'complete'">
            <span><small>Одежда и fashionware</small><EurodollarAmount :amount="summary.fashionLimit" /></span>
            <span><small>Осталось на одежду</small><EurodollarAmount :amount="summary.fashionLimit - summary.fashion" /></span>
          </template>
        </div>
        <p v-for="error in summary.errors" :key="error" class="red-danger">{{ error }}</p>
      </template>
      <template #cart>
        <WizardShopCartLine v-for="entry in draft.cart" :key="entry.uid" :item="byKey[entry.key] || { name: entry.key }"
           @details="viewItem = byKey[entry.key]" @remove="remove(entry)">
          <template #price><EurodollarAmount v-if="byKey[entry.key]" :amount="cartPrice(entry)" /></template>
          <template #quantity>
            <FormNumberInput :value="entry.count" :min="1" :max="9999" @change="changeCount(entry, $event)" />
          </template>
          <FormField v-if="byKey[entry.key]?.kind === 'cyberware'" label="Расположение" vertical
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
        </WizardShopCartLine>
      </template>
      <template #totals>
        <span>Итого <strong><EurodollarAmount :amount="summary.general + summary.fashion" /></strong></span>
        <span>Остаток <strong><EurodollarAmount :amount="summary.cash" /></strong></span>
      </template>
      <template #extras>
        <WizardSectionPanel v-if="draft.method !== 'complete'" class="shopping-panel kit-panel">
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
          <details v-if="giftRows.length" class="kit-grants">
            <summary>Уже выдано · {{ giftRows.length }} поз.</summary>
            <div v-for="(row, i) in giftRows" :key="i" class="kit-row">
              <WizardShopItemIcon :item="byKey[row.key] || {}" :size="30" />
              <span>{{ byKey[row.key]?.name || row.key }}</span
              ><strong>×{{ row.count }}</strong>
            </div>
          </details>
          <small>Выданное комплектом не уменьшает дополнительные <EurodollarAmount :amount="500" />.</small>
        </WizardSectionPanel>
      </template>
    </WizardShop>
    <ItemViewModal v-if="viewItem" :item-id="viewItem.id" :item-type-id="viewItem.typeId" @close="viewItem = null" />
  </div>
</template>
<script setup>
import EurodollarAmount from '@/shared/ui/EurodollarAmount.vue'
import { computed, ref } from "vue";
import {
  FormField,
  FormSelect,
  FormNumberInput,
} from "@sylvieshare/share-ui";
import WizardSectionPanel from "@/shared/ui/WizardSectionPanel.vue";
import ItemViewModal from "@/features/handbook/components/ItemViewModal.vue";
import WizardShopOffer from "../WizardShopOffer.vue";
import WizardShopCartLine from "../WizardShopCartLine.vue";
import WizardShop from "../WizardShop.vue";
import WizardShopItemIcon from "../WizardShopItemIcon.vue";
import {
  RED_STARTING_KITS,
  redKitRows,
} from "@/features/character-editor/settings/cyberpunk-red/startingKits";
import { redFashionEligible } from "@/features/character-editor/settings/cyberpunk-red/equipment";
const props = defineProps({
  draft: Object,
  items: Array,
  summary: Object,
  typeById: { type: Function, required: true },
});
const emit = defineEmits(["patch"]);
const viewItem = ref(null);
const cartCount = computed(() => props.draft.cart.reduce((sum, line) => sum + line.count, 0));
function cartPrice(entry) {
  const facts = byKey.value[entry.key]?.facts;
  return facts.price * entry.count / (facts.quantity || 1);
}
function remove(entry) {
  emit("patch", { cart: props.draft.cart.filter(line => line.uid !== entry.uid) });
}
const byKey = computed(() => Object.fromEntries(props.items.map(item => [item.key, item])));
const categoryOf = item => item.typeId;
const available = computed(() => props.items.filter(item =>
  !["criticalInjury", "role", "skill"].includes(item.kind) && item.facts.price > 0));
const categories = computed(() => {
  const groups = new Map();
  for (const item of available.value) {
    if (groups.has(item.typeId)) continue;
    const type = props.typeById(item.typeId);
    groups.set(item.typeId, { id: item.typeId, label: type?.name || item.kind, type });
  }
  return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label, "ru"));
});
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
.kit-panel, .kit-panel > *, .kit-panel :deep(select) { min-width: 0; max-width: 100%; }
.kit-grants summary { cursor: pointer; font-weight: 600; }
.kit-row { margin-top: var(--spacing-small); display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: var(--spacing-small); overflow-wrap: anywhere; }
.shopping-panel h3 { margin: 0; font-size: var(--type-row-size); }
.shopping-panel small { color: var(--text-muted); }
</style>
