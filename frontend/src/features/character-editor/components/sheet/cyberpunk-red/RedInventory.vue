<template>
  <div class="red-stack">
    <BaseTile :outlined="false"
      ><div class="red-panel">
        <div class="red-row">
          <h2>{{ combat ? "Оружие и броня" : "Предметы" }}</h2>
          <ActionButton v-if="editable" @click="picker = true"
            >Добавить</ActionButton
          >
        </div>
        <FormField v-if="!combat" label="Евробаксы" vertical
          ><FormNumberInput
            v-if="editable"
            :value="values.economy.cashEb"
            :min="0"
            @change="
              emit('patch', { economy: { ...values.economy, cashEb: $event } })
            "
          /><strong v-else>{{ values.economy.cashEb }} eb</strong></FormField
        >
        <p v-if="error" class="red-danger" role="alert">{{ error }}</p>
        <FormField v-if="editable" label="Добавление предметов" vertical
          ><FormSelect v-model:value="acquire"
            ><option value="buy">Купить по цене справочника</option>
            <option value="grant">
              Получено от ведущего / добыча
            </option></FormSelect
          ></FormField
        >
        <ActionButton
          v-if="editable && !combat"
          @click="externalMedtech = !externalMedtech"
          >{{
            externalMedtech
              ? "Введение препарата: Медтехник рядом"
              : "Введение препарата: самостоятельно"
          }}</ActionButton
        >
        <p v-if="!entries.length" class="red-muted">
          Пока нет предметов в этом разделе.
        </p>
        <article
          v-for="entry in entries"
          :key="entry.uid"
          class="red-list-item"
        >
          <div class="red-row">
            <div>
              <h3>{{ byKey[entry.key]?.name || entry.key }}</h3>
              <small
                >{{ byKey[entry.key]?.nameEn }} · {{ entry.count }} шт.</small
              >
            </div>
            <ActionButton v-if="editable" variant="quiet" @click="remove(entry)"
              >Убрать</ActionButton
            >
          </div>
          <template
            v-if="
              byKey[entry.key]?.kind === 'weapon' ||
              byKey[entry.key]?.facts.weapon
            "
            ><div class="red-actions">
              <strong>{{
                redBaseWeaponDamage(
                  byKey[entry.key].facts,
                  redEffectiveStats(values, items).BODY,
                  values.cyberware.installations.some(
                    (e) => e.key === "cyberware-cyberarm" && !e.disabled,
                  ),
                )
              }}</strong
              ><span>ROF {{ byKey[entry.key].facts.rof }}</span
              ><span v-if="byKey[entry.key].facts.magazine"
                >{{ entry.loaded || 0 }} /
                {{ byKey[entry.key].facts.magazine }} патронов</span
              ><small
                v-if="
                  byKey[entry.key].facts.weaponType === 'unarmed' ||
                  byKey[entry.key].facts.weaponType === 'martialArts'
                "
                >Урон по BODY рассчитывается при броске</small
              ><small v-if="byKey[entry.key].facts.reloadActions > 1"
                >Перезарядка:
                {{ byKey[entry.key].facts.reloadActions }} действия</small
              ><span v-if="entry.jammed" class="red-danger">Заклинило</span>
            </div>
            <div class="red-actions">
              <ActionButton
                v-if="editable && byKey[entry.key].facts.bodyRequired"
                @click="change(entry, { mounted: !entry.mounted })"
                >{{ entry.mounted ? "На станке" : "В руках" }}</ActionButton
              ><ActionButton
                v-if="editable && entry.key === 'weapon-kendachi-mono-three'"
                @click="change(entry, { biometricKey: !entry.biometricKey })"
                >{{
                  entry.biometricKey
                    ? "Биометрия: включена"
                    : "Биометрия: выключена"
                }}</ActionButton
              ><ActionButton
                :disabled="
                  !entry.equipped || !redCyberWeaponAvailable(entry, values)
                "
                @click="
                  emit('roll', {
                    kind: 'attack',
                    entryUid: entry.uid,
                    title: byKey[entry.key].name,
                  })
                "
                >Атака</ActionButton
              ><ActionButton
                :disabled="!entry.lastAttack || entry.lastAttack.damageResolved"
                @click="emit('damage', entry)"
                >Урон</ActionButton
              ><ActionButton
                v-if="editable && byKey[entry.key].facts.magazine"
                @click="reloadEntry = entry"
                >Перезарядить</ActionButton
              ><ActionButton
                v-if="editable && entry.jammed"
                @click="change(entry, { jammed: false })"
                >Устранить клин</ActionButton
              >
            </div></template
          >
          <div v-if="byKey[entry.key]?.kind === 'armor'" class="red-two">
            <FormField
              v-if="byKey[entry.key].facts.bodySP"
              label="Износ SP тела"
              vertical
              ><FormNumberInput
                v-if="editable"
                :value="entry.ablation?.body || 0"
                :min="0"
                :max="byKey[entry.key].facts.bodySP"
                @change="
                  change(entry, {
                    ablation: { ...entry.ablation, body: $event },
                  })
                "
              /><span
                >SP
                {{
                  Math.max(
                    0,
                    byKey[entry.key].facts.bodySP - (entry.ablation?.body || 0),
                  )
                }}</span
              ></FormField
            ><FormField
              v-if="byKey[entry.key].facts.headSP"
              label="Износ SP головы"
              vertical
              ><FormNumberInput
                v-if="editable"
                :value="entry.ablation?.head || 0"
                :min="0"
                :max="byKey[entry.key].facts.headSP"
                @change="
                  change(entry, {
                    ablation: { ...entry.ablation, head: $event },
                  })
                "
              /><span
                >SP
                {{
                  Math.max(
                    0,
                    byKey[entry.key].facts.headSP - (entry.ablation?.head || 0),
                  )
                }}</span
              ></FormField
            ><FormField
              v-if="byKey[entry.key].facts.shieldHP"
              label="HP щита"
              vertical
              ><FormNumberInput
                v-if="editable"
                :value="entry.shieldHP ?? byKey[entry.key].facts.shieldHP"
                :min="0"
                :max="byKey[entry.key].facts.shieldHP"
                @change="change(entry, { shieldHP: $event })"
              /><span v-else>{{
                entry.shieldHP ?? byKey[entry.key].facts.shieldHP
              }}</span></FormField
            >
          </div>
          <small v-if="byKey[entry.key]?.description">{{
            byKey[entry.key].description
          }}</small>
          <div v-if="editable" class="red-actions">
            <ActionButton
              v-if="['drug', 'pharmaceutical'].includes(byKey[entry.key]?.kind)"
              :disabled="entry.count < 1"
              @click="consume(entry)"
              >Применить дозу</ActionButton
            ><ActionButton
              v-for="bonus in (byKey[entry.key]?.facts.bonuses || []).filter(
                (b) => b.conditional,
              )"
              :key="bonus.target"
              @click="toggleBonus(entry, bonus.target)"
              >{{ entry.enabledBonuses?.includes(bonus.target) ? "✓ " : ""
              }}{{ bonus.target }} {{ bonus.value }}</ActionButton
            ><ActionButton
              @click="change(entry, { equipped: !entry.equipped })"
              >{{ entry.equipped ? "Снять" : "Экипировать" }}</ActionButton
            ><FormNumberInput
              :value="entry.count"
              :min="0"
              :max="99999"
              @change="change(entry, { count: $event })"
            />
          </div>
        </article></div
    ></BaseTile>
    <RedItemPicker
      v-if="picker"
      :items="items"
      :kinds="
        combat
          ? ['weapon', 'armor']
          : [
              'weapon',
              'armor',
              'ammo',
              'gear',
              'clothing',
              'cyberdeck',
              'program',
              'blackIce',
              'vehicle',
              'drug',
              'pharmaceutical',
              'itemUpgrade',
            ]
      "
      @close="picker = false"
      @select="add"
    />
    <AppModal v-if="reloadEntry" @close="reloadEntry = null"
      ><div class="red-panel">
        <h2>Перезарядка</h2>
        <p>
          Выберите запас боеприпасов. Остаток магазина сначала возвращается в
          прежний запас.
        </p>
        <div v-for="ammo in compatibleAmmo" :key="ammo.uid" class="red-row">
          <span>{{ byKey[ammo.key]?.name }} · {{ ammo.count }}</span
          ><ActionButton @click="reload(ammo)">Зарядить</ActionButton>
        </div>
        <p v-if="!compatibleAmmo.length">
          Совместимых боеприпасов нет. Добавьте их в предметы.
        </p>
      </div></AppModal
    >
  </div>
</template>
<script setup>
import { computed, ref } from "vue";
import {
  BaseTile,
  ActionButton,
  FormNumberInput,
  FormField,
  FormSelect,
  AppModal,
} from "@sylvieshare/share-ui";
import { redUseConsumable } from "../../../settings/cyberpunk-red/effects";
import {
  redEffectiveStats,
  redMaximumHealth,
} from "../../../settings/cyberpunk-red/equipment";
import {
  redCyberWeaponAvailable,
  redBaseWeaponDamage,
} from "../../../settings/cyberpunk-red/cyberWeapons";
import RedItemPicker from "./RedItemPicker.vue";
const props = defineProps({
  values: Object,
  items: Array,
  editable: Boolean,
  combat: Boolean,
});
const emit = defineEmits(["patch", "roll", "damage"]);
const externalMedtech = ref(false);
const picker = ref(false),
  reloadEntry = ref(null),
  acquire = ref("buy"),
  error = ref("");
const byKey = computed(() =>
  Object.fromEntries(props.items.map((i) => [i.key, i])),
);
const entries = computed(() =>
  (props.values.inventory.entries || []).filter(
    (e) =>
      !props.combat ||
      ["weapon", "armor"].includes(byKey.value[e.key]?.kind) ||
      byKey.value[e.key]?.facts.weapon,
  ),
);
function save(entries) {
  emit("patch", { inventory: { ...props.values.inventory, entries } });
}
function change(entry, patch) {
  save(
    props.values.inventory.entries.map((e) =>
      e.uid === entry.uid ? { ...e, ...patch } : e,
    ),
  );
}
function remove(entry) {
  if (entry.linkedCyberUid) {
    error.value = "Чтобы убрать кибероружие, снимите имплант";
    return;
  }
  if (
    props.values.inventory.entries.some(
      (e) => e.ammoUid === entry.uid && e.loaded > 0,
    )
  ) {
    error.value =
      "Этот запас связан с заряженным оружием. Сначала разрядите или перезарядите его";
    return;
  }
  if (
    props.values.netrunning.loadedPrograms.some((p) => p.entryUid === entry.uid)
  ) {
    error.value = "Сначала выгрузите программу из деки";
    return;
  }
  save(props.values.inventory.entries.filter((e) => e.uid !== entry.uid));
}
function add(item) {
  const cost = acquire.value === "buy" ? item.facts.price : 0;
  if (!Number.isFinite(cost) || props.values.economy.cashEb < cost) {
    error.value =
      "Не хватает денег или у предмета нет цены: используйте получение от ведущего";
    return;
  }
  emit("patch", {
    economy: {
      ...props.values.economy,
      cashEb: props.values.economy.cashEb - cost,
    },
  });
  save([
    ...props.values.inventory.entries,
    {
      uid: crypto.randomUUID(),
      key: item.key,
      itemId: item.id,
      count: item.facts.quantity || 1,
      equipped: false,
      loaded: 0,
      ablation: { head: 0, body: 0 },
      spaceUid: props.values.inventory.spaces?.[0]?.uid,
    },
  ]);
  picker.value = false;
}
const compatibleAmmo = computed(() => {
  const f = byKey.value[reloadEntry.value?.key]?.facts;
  return props.values.inventory.entries.filter(
    (e) =>
      byKey.value[e.key]?.kind === "ammo" &&
      f?.ammo?.includes(byKey.value[e.key].facts.ammoVariety) &&
      e.count > 0,
  );
});
function toggleBonus(entry, key) {
  const list = entry.enabledBonuses || [];
  change(entry, {
    enabledBonuses: list.includes(key)
      ? list.filter((k) => k !== key)
      : [...list, key],
  });
}
function consume(entry) {
  try {
    error.value = "";
    const item = byKey.value[entry.key],
      stats = redEffectiveStats(props.values, props.items),
      next = redUseConsumable({ ...props.values, stats }, item, entry.uid, {
        medtech:
          externalMedtech.value ||
          props.values.roles.some((r) => r.key === "medtech"),
      });
    next.health.current = Math.min(
      redMaximumHealth(props.values, props.items),
      next.health.current,
    );
    emit("patch", {
      inventory: next.inventory,
      health: next.health,
      humanity: next.humanity,
    });
  } catch (e) {
    error.value = e.message;
  }
}
function reload(ammo) {
  const entries = JSON.parse(JSON.stringify(props.values.inventory.entries)),
    gun = entries.find((e) => e.uid === reloadEntry.value.uid),
    stock = entries.find((e) => e.uid === ammo.uid);
  const required = byKey.value[gun.key].facts.reloadActions || 1;
  if ((gun.reloadProgress || 0) + 1 < required) {
    gun.reloadProgress = (gun.reloadProgress || 0) + 1;
    save(entries);
    error.value =
      "Первое действие перезарядки выполнено. В следующий ход завершите перезарядку";
    reloadEntry.value = null;
    return;
  }
  gun.reloadProgress = 0;
  const previous = entries.find((e) => e.uid === gun.ammoUid);
  if ((gun.loaded || 0) > 0 && !previous) {
    error.value =
      "Не найден запас текущих патронов. Восстановите запись перед перезарядкой";
    return;
  }
  if (previous) previous.count += gun.loaded || 0;
  const count = Math.min(stock.count, byKey.value[gun.key].facts.magazine);
  stock.count -= count;
  gun.loaded = count;
  gun.ammoUid = stock.uid;
  save(entries);
  reloadEntry.value = null;
}
</script>
