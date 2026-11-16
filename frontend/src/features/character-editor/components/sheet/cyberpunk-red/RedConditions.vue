<template>
  <BaseTile :outlined="false"
    ><div class="red-panel">
      <h2>Состояния и препараты</h2>
      <p v-if="error" role="alert" class="red-danger">{{ error }}</p>
      <article
        v-for="c in values.health.conditions || []"
        :key="c.uid"
        class="red-list-item"
      >
        <h3>{{ c.name || byKey[c.key]?.name || c.key }}</h3>
        <p>
          {{ c.duration }} {{ c.phase === "secondary" ? "· зависимость" : "" }}
        </p>
        <small v-if="byKey[c.key]">{{ byKey[c.key].description }}</small>
        <div v-if="editable" class="red-actions">
          <template v-if="c.phase === 'primary'"
            ><ActionButton @click="resist(c)">Проверка зависимости</ActionButton
            ><ActionButton @click="endDrug(c, true)"
              >Эффект закончился · успех</ActionButton
            ><ActionButton @click="endDrug(c, false)"
              >Эффект закончился · провал</ActionButton
            ></template
          >
          <ActionButton v-else @click="remove(c)">{{
            c.phase === "secondary"
              ? "Зависимость вылечена"
              : "Завершить эффект"
          }}</ActionButton>
        </div>
      </article>
      <p v-if="!values.health.conditions?.length">Нет активных состояний.</p>
      <div v-if="editable" class="red-actions">
        <FormSelect v-model:value="condition"
          ><option value="grappled">В захвате · −2 к действиям</option>
          <option value="prone">Лёжа · встать за действие</option>
          <option value="unconscious">Без сознания</option>
          <option value="fire2">Горение · 2 HP/ход</option>
          <option value="fire4">Горение · 4 HP/ход</option>
          <option value="fire6">Горение · 6 HP/ход</option></FormSelect
        ><ActionButton @click="add">Добавить состояние</ActionButton
        ><ActionButton @click="endTurn">Конец хода · горение</ActionButton>
      </div>
      <small
        >Конец действия вещества и успешное лечение подтверждаются после
        проверки и решения ведущего. Длительности отсчитываются в игровом
        времени.</small
      >
    </div></BaseTile
  >
</template>
<script setup>
import { computed, ref } from "vue";
import { BaseTile, FormSelect, ActionButton } from "@sylvieshare/share-ui";
import { redEndDrug } from "../../../settings/cyberpunk-red/effects";
const props = defineProps({ values: Object, items: Array, editable: Boolean }),
  emit = defineEmits(["patch", "roll"]);
const condition = ref("grappled"),
  error = ref(""),
  byKey = computed(() =>
    Object.fromEntries(props.items.map((i) => [i.key, i])),
  );
function resetMedicine(week) {
  emit("patch", {
    health: {
      ...props.values.health,
      medicineUsed: week
        ? []
        : (props.values.health.medicineUsed || []).filter(
            (k) => k === "pharma-surge",
          ),
    },
  });
}
function save(conditions) {
  emit("patch", { health: { ...props.values.health, conditions } });
}
function remove(c) {
  save(props.values.health.conditions.filter((e) => e.uid !== c.uid));
}
function resist(c) {
  const s = props.values.skills.find((s) => s.key === "resist-torture-drugs");
  emit("roll", {
    kind: "check",
    skillKey: "resist-torture-drugs",
    skillUid: s?.uid || "",
    dv: byKey.value[c.key]?.facts.addictionDV,
    title: "Сопротивление зависимости",
  });
}
function endDrug(c, success) {
  const next = redEndDrug(props.values, c.uid, success);
  emit("patch", { health: next.health, humanity: next.humanity });
}
function add() {
  const key = condition.value,
    conditions = props.values.health.conditions || [];
  if (conditions.some((c) => c.key === key)) return;
  const name =
    { grappled: "В захвате", prone: "Лёжа", unconscious: "Без сознания" }[
      key
    ] || "Горение";
  save([
    ...conditions,
    {
      uid: crypto.randomUUID(),
      key,
      name,
      duration: "До прекращения",
      bonuses: key === "grappled" ? [{ target: "all-actions", value: -2 }] : [],
      damagePerTurn: key.startsWith("fire") ? Number(key.slice(4)) : 0,
    },
  ]);
}
function endTurn() {
  if (props.values.health.dead) return;
  const damage = Math.max(
    0,
    ...(props.values.health.conditions || []).map((c) => c.damagePerTurn || 0),
  );
  emit("patch", {
    health: {
      ...props.values.health,
      current: Math.max(0, props.values.health.current - damage),
      deathSavePenalty:
        (props.values.health.deathSavePenalty || 0) +
        (damage > 0 && props.values.health.current <= 0 ? 1 : 0),
      stabilized: damage > 0 ? false : props.values.health.stabilized,
    },
  });
}
</script>
