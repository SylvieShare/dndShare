<template>
  <div class="red-stack">
    <BaseTile :outlined="false"
      ><div class="red-panel">
        <div class="red-row">
          <h2>Киберимпланты</h2>
          <ActionButton v-if="editable" @click="picker = true"
            >Установить</ActionButton
          >
        </div>
        <p v-if="error" role="alert" class="red-danger">{{ error }}</p>
        <p v-if="!values.cyberware.installations.length">Имплантов пока нет.</p>
        <article
          v-for="entry in values.cyberware.installations"
          :key="entry.uid"
          class="red-list-item"
        >
          <div class="red-row">
            <div>
              <h3>{{ byKey[entry.key]?.name || entry.key }}</h3>
              <small
                >{{ byKey[entry.key]?.facts.cyberCategory }} ·
                {{ entry.location || "Тело" }}</small
              ><small v-if="byKey[entry.key]?.facts.foundation"
                >Слоты {{ slotUse[entry.uid] || 0 }} /
                {{ byKey[entry.key].facts.slots }}</small
              ><small v-else-if="entry.parentUid"
                >Основание: {{ parentName(entry.parentUid) }}</small
              >
            </div>
            <ActionButton v-if="editable" variant="quiet" @click="remove(entry)"
              >Снять</ActionButton
            >
          </div>
          <div v-if="editable" class="red-actions">
            <ActionButton
              @click="change(entry, { disabled: !entry.disabled })"
              >{{
                entry.disabled ? "Включить" : "Отключить (ЭМИ)"
              }}</ActionButton
            ><ActionButton
              v-if="entry.key === 'cyberware-sandevistan'"
              @click="change(entry, { active: !entry.active })"
              >{{
                entry.active
                  ? "Сандевистан: выключить"
                  : "Сандевистан: на минуту"
              }}</ActionButton
            ><ActionButton
              v-for="bonus in (byKey[entry.key]?.facts.bonuses || []).filter(
                (b) => b.conditional,
              )"
              :key="bonus.target"
              @click="toggleBonus(entry, bonus.target)"
              >{{ entry.enabledBonuses?.includes(bonus.target) ? "✓ " : ""
              }}{{ bonus.target }} {{ bonus.value > 0 ? "+" : ""
              }}{{ bonus.value }}</ActionButton
            >
          </div>
          <div
            v-if="
              ['cyberware-subdermal-armor', 'cyberware-skin-weave'].includes(
                entry.key,
              ) && editable
            "
            class="red-actions"
          >
            <ActionButton @click="repair(entry)"
              >Восстановить 1 SP · день отдыха</ActionButton
            >
          </div>
        </article>
        <small
          >Снятие импланта освобождает максимум человечности, но само по себе не
          возвращает потерянную человечность.</small
        >
      </div></BaseTile
    ><BaseTile :outlined="false"
      ><div class="red-panel">
        <h2>Терапия</h2>
        <p>
          После успешной терапии укажите восстановленные пункты. Значение
          ограничено текущим максимумом с учётом имплантов.
        </p>
        <FormNumberInput
          v-if="editable"
          :value="therapy"
          :min="0"
          :max="24"
          @change="therapy = $event"
        /><ActionButton v-if="editable" @click="applyTherapy"
          >Восстановить человечность</ActionButton
        >
      </div></BaseTile
    >
    <RedItemPicker
      v-if="picker"
      :items="items"
      :kinds="['cyberware']"
      title="Киберимплант"
      @select="
        selected = $event;
        picker = false;
      "
      @close="picker = false"
    />
    <AppModal v-if="selected" @close="selected = null"
      ><div class="red-panel">
        <h2>{{ selected.name }}</h2>
        <p>
          Стоимость {{ selected.facts.price }} eb · потеря Humanity
          {{ selected.facts.humanityRoll }}.
        </p>
        <FormField label="Основание" vertical
          ><FormSelect v-model:value="parentUid"
            ><option value="">Без основания / органическая конечность</option>
            <option v-for="e in foundations" :key="e.uid" :value="e.uid">
              {{ byKey[e.key]?.name }} · {{ e.location || e.uid.slice(0, 4) }}
            </option></FormSelect
          ></FormField
        ><FormField label="Расположение" vertical
          ><FormSelect v-model:value="location"
            ><option value="body">Тело</option>
            <option value="left-eye">Левый глаз</option>
            <option value="right-eye">Правый глаз</option>
            <option value="flesh-arm-left">Левая рука</option>
            <option value="flesh-arm-right">Правая рука</option>
            <option value="flesh-leg-left">Левая нога</option>
            <option value="flesh-leg-right">Правая нога</option></FormSelect
          ></FormField
        >
        <p v-if="error" class="red-danger">{{ error }}</p>
        <ActionButton @click="install">Купить и установить</ActionButton>
      </div></AppModal
    >
  </div>
</template>
<script setup>
import { computed, ref } from "vue";
import {
  BaseTile,
  ActionButton,
  AppModal,
  FormField,
  FormSelect,
  FormNumberInput,
} from "@sylvieshare/share-ui";
import { redCyberWeaponEntry } from "../../../settings/cyberpunk-red/cyberWeapons";
import RedItemPicker from "./RedItemPicker.vue";
import {
  redCyberValidation,
  redCyberRequirement,
  redCyberCapacity,
} from "../../../settings/cyberpunk-red/equipment";
const props = defineProps({ values: Object, items: Array, editable: Boolean });
const emit = defineEmits(["patch"]);
const picker = ref(false),
  selected = ref(null),
  parentUid = ref(""),
  location = ref("body"),
  error = ref(""),
  therapy = ref(0);
const byKey = computed(() =>
  Object.fromEntries(props.items.map((i) => [i.key, i])),
);
const foundations = computed(() =>
  props.values.cyberware.installations.filter(
    (e) =>
      redCyberCapacity(e, props.values.cyberware.installations, props.items) >
      0,
  ),
);
const slotUse = computed(
  () =>
    redCyberValidation(
      props.values.cyberware.installations,
      props.items,
      props.values.stats,
    ).used,
);
const parentName = (id) =>
  byKey.value[
    props.values.cyberware.installations.find((e) => e.uid === id)?.key
  ]?.name || "Не найдено";
function install() {
  try {
    error.value = "";
    const item = selected.value;
    if (props.values.economy.cashEb < item.facts.price)
      throw new Error("Не хватает евробаксов");
    const req = redCyberRequirement(item);
    const entry = {
      uid: crypto.randomUUID(),
      key: item.key,
      itemId: item.id,
      parentUid: parentUid.value || null,
      location: location.value,
    };
    if (
      req?.startsWith("flesh-") &&
      !entry.parentUid &&
      !entry.location.startsWith(req)
    )
      throw new Error("Выберите подходящую конечность");
    const installations = [...props.values.cyberware.installations, entry],
      check = redCyberValidation(
        installations,
        props.items,
        props.values.stats,
      );
    if (check.errors.length) throw new Error(check.errors.join("; "));
    const formula = String(item.facts.humanityRoll || "0"),
      m = formula.match(/^([1-8])d([36])(?:\/(2))?$/);
    if (!m && Number(item.facts.humanity) !== 0)
      throw new Error("Формула потери человечности требует проверки");
    let loss = m
      ? Array.from(
          { length: Number(m[1]) },
          () => 1 + Math.floor(Math.random() * Number(m[2])),
        ).reduce((a, b) => a + b, 0)
      : 0;
    if (m?.[3]) loss = Math.ceil(loss / 2);
    emit("patch", {
      inventory: {
        ...props.values.inventory,
        entries: [
          ...props.values.inventory.entries,
          ...[
            redCyberWeaponEntry(
              entry,
              item,
              props.values.inventory.spaces?.[0]?.uid,
            ),
          ].filter(Boolean),
        ],
      },
      cyberware: { ...props.values.cyberware, installations },
      humanity: {
        ...props.values.humanity,
        current: props.values.humanity.current - loss,
        adjustments: [
          ...(props.values.humanity.adjustments || []),
          {
            uid: crypto.randomUUID(),
            kind: "installation",
            itemKey: item.key,
            value: -loss,
          },
        ],
      },
      economy: {
        ...props.values.economy,
        cashEb: props.values.economy.cashEb - item.facts.price,
      },
    });
    selected.value = null;
    parentUid.value = "";
  } catch (e) {
    error.value = e.message;
  }
}
function change(entry, patch) {
  emit("patch", {
    cyberware: {
      ...props.values.cyberware,
      installations: props.values.cyberware.installations.map((e) =>
        e.uid === entry.uid ? { ...e, ...patch } : e,
      ),
    },
  });
}
function toggleBonus(entry, key) {
  const list = entry.enabledBonuses || [];
  change(entry, {
    enabledBonuses: list.includes(key)
      ? list.filter((k) => k !== key)
      : [...list, key],
  });
}
function remove(entry) {
  if (
    props.values.cyberware.installations.some((e) => e.parentUid === entry.uid)
  ) {
    error.value = "Сначала снимите установленные в это основание опции";
    return;
  }
  emit("patch", {
    cyberware: {
      ...props.values.cyberware,
      installations: props.values.cyberware.installations.filter(
        (e) => e.uid !== entry.uid,
      ),
    },
    inventory: {
      ...props.values.inventory,
      entries: props.values.inventory.entries.filter(
        (e) => e.linkedCyberUid !== entry.uid,
      ),
    },
  });
}
function repair(entry) {
  emit("patch", {
    cyberware: {
      ...props.values.cyberware,
      installations: props.values.cyberware.installations.map((e) =>
        e.uid === entry.uid
          ? {
              ...e,
              ablation: {
                head: Math.max(0, (e.ablation?.head || 0) - 1),
                body: Math.max(0, (e.ablation?.body || 0) - 1),
              },
            }
          : e,
      ),
    },
  });
}
function applyTherapy() {
  const loss = props.values.cyberware.installations.reduce(
    (n, e) =>
      n +
      (byKey.value[e.key]?.facts.humanity > 0
        ? byKey.value[e.key].facts.cyberCategory === "borgware"
          ? 4
          : 2
        : 0),
    0,
  );
  emit("patch", {
    humanity: {
      ...props.values.humanity,
      current: Math.min(
        Math.max(0, props.values.stats.EMP * 10 - loss),
        props.values.humanity.current + therapy.value,
      ),
    },
  });
  therapy.value = 0;
}
</script>
