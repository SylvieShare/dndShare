<template>
  <div class="red-section">
    <p v-for="line in benefits" :key="line">{{ line }}</p>
    <template v-if="role.key === 'tech'">
      <h3>Мастерская</h3>
      <FormField label="Предмет / прототип" vertical
        ><FormSelect v-model:value="itemKey"
          ><option value="">Выберите предмет</option>
          <option
            v-for="i in items.filter((i) => i.facts.price > 0)"
            :key="i.key"
            :value="i.key"
          >
            {{ i.name }} · {{ i.facts.price }} €$
          </option></FormSelect
        ></FormField
      >
      <FormField label="Работа" vertical
        ><FormSelect v-model:value="mode"
          ><option value="field">Ремонт / полевая экспертиза</option>
          <option value="fabrication">Изготовление</option>
          <option value="upgrade">Модернизация</option>
          <option value="invention">Изобретение</option></FormSelect
        ></FormField
      >
      <FormField label="Технический навык" vertical
        ><FormSelect v-model:value="skillKey"
          ><option v-for="key in techSkills" :key="key" :value="key">
            {{ RED_SKILLS_BY_KEY[key]?.name }}
          </option></FormSelect
        ></FormField
      >
      <p v-if="plan">
        DV {{ plan.dv }} · {{ plan.time }} · материалы
        <EurodollarAmount :amount="mode === 'field' ? 0 : plan.materials" />
      </p>
      <ActionButton :disabled="!editable || !plan" @click="work"
        >Проверка работы</ActionButton
      >
      <small
        >Модернизация транспортного средства рассчитывается как Very Expensive.
        После успешной проверки сохраните изготовленный предмет или изменения
        его параметров в справочнике. Материалы не пропадают при провале Maker;
        на неудачную попытку уходит половина времени.</small
      >
    </template>
    <template v-if="role.key === 'exec'"
      ><h3>Команда · {{ team.length }} / {{ teamLimit }}</h3>
      <div v-for="member in team" :key="member.uid" class="red-list-item">
        <FormTextInput
          :value="member.name"
          :disabled="!editable"
          placeholder="Имя и должность"
          @update:value="changeMember(member, { name: $event })"
        /><FormField label="Лояльность" vertical
          ><FormNumberInput
            :value="member.loyalty"
            :min="-100"
            :max="100"
            :disabled="!editable"
            @change="changeMember(member, { loyalty: $event })" /></FormField
        ><FormTextarea
          :value="member.notes || ''"
          :disabled="!editable"
          placeholder="Статистики, снаряжение, поручение"
          @update:value="changeMember(member, { notes: $event })"
        /><ActionButton
          v-if="editable"
          @click="saveTeam(team.filter((m) => m.uid !== member.uid))"
          >Убрать сотрудника</ActionButton
        >
      </div>
      <ActionButton
        v-if="editable"
        :disabled="team.length >= teamLimit"
        @click="addMember"
        >Добавить сотрудника</ActionButton
      ><small
        >Начальную лояльность определяет ведущий: d6 + 1. Между сессиями
        максимум 10; в течение сессии верхнего предела нет. Проверки поручений
        выполняет ведущий.</small
      ></template
    >
    <template v-if="role.key === 'nomad'"
      ><h3>Семейный автопарк</h3>
      <FormSelect v-if="editable" v-model:value="vehicleKey"
        ><option value="">Выберите транспорт</option>
        <option
          v-for="i in items.filter((i) => i.kind === 'vehicle')"
          :key="i.key"
          :value="i.key"
        >
          {{ i.name }}
        </option></FormSelect
      ><ActionButton
        v-if="editable"
        :disabled="!vehicleKey || (role.vehicles || []).length >= role.rank"
        @click="addVehicle"
        >Выделить из автопарка</ActionButton
      >
      <div
        v-for="vehicle in role.vehicles || []"
        :key="vehicle.uid"
        class="red-list-item"
      >
        <h4>{{ items.find((i) => i.key === vehicle.key)?.name }}</h4>
        <FormField label="Текущий SDP" vertical
          ><FormNumberInput
            :value="vehicle.sdp"
            :min="0"
            :max="1000"
            :disabled="!editable"
            @change="changeVehicle(vehicle, { sdp: $event })" /></FormField
        ><FormTextarea
          :value="vehicle.upgrades || ''"
          :disabled="!editable"
          placeholder="Модификации, состояние окон, оружие, доступность"
          @update:value="changeVehicle(vehicle, { upgrades: $event })"
        /></div
    ></template>
  </div>
</template>
<script setup>
import EurodollarAmount from '@/shared/ui/EurodollarAmount.vue'
import { computed, ref } from "vue";
import {
  FormField,
  FormSelect,
  FormTextInput,
  FormNumberInput,
  FormTextarea,
  ActionButton,
} from "@sylvieshare/share-ui";
import {
  redRoleBenefits,
  redWorkshop,
} from "../../../settings/cyberpunk-red/roleRules";
import { RED_SKILLS_BY_KEY } from "../../../settings/cyberpunk-red/catalogue";
const props = defineProps({
    role: Object,
    values: Object,
    items: Array,
    editable: Boolean,
  }),
  emit = defineEmits(["change", "roll"]);
const benefits = computed(() => redRoleBenefits(props.role)),
  itemKey = ref(""),
  mode = ref("fabrication"),
  skillKey = ref("basic-tech"),
  vehicleKey = ref("");
const techSkills = [
  "basic-tech",
  "cybertech",
  "electronics-security-tech",
  "weaponstech",
  "air-vehicle-tech",
  "land-vehicle-tech",
  "sea-vehicle-tech",
];
const plan = computed(() => {
  const i = props.items.find((i) => i.key === itemKey.value);
  return i
    ? redWorkshop(
        i.kind === "vehicle" && mode.value === "upgrade" ? 1000 : i.facts.price,
        mode.value,
      )
    : null;
});
function work() {
  const skill = props.values.skills.find((s) => s.key === skillKey.value);
  emit("roll", {
    kind: "check",
    skillKey: skillKey.value,
    skillUid: skill?.uid || "",
    mode: "tech:" + mode.value,
    dv: plan.value.dv,
    title:
      "Мастерская: " + props.items.find((i) => i.key === itemKey.value)?.name,
  });
}
const team = computed(() => props.role.team || []),
  teamLimit = computed(() =>
    props.role.rank >= 9
      ? 3
      : props.role.rank >= 5
        ? 2
        : props.role.rank >= 3
          ? 1
          : 0,
  );
function addMember() {
  saveTeam([
    ...team.value,
    {
      uid: crypto.randomUUID(),
      name: "Новый сотрудник",
      loyalty: 2,
      notes: "",
    },
  ]);
}
function saveTeam(value) {
  emit("change", { team: value });
}
function changeMember(member, patch) {
  saveTeam(
    team.value.map((m) => (m.uid === member.uid ? { ...m, ...patch } : m)),
  );
}
function addVehicle() {
  const i = props.items.find((i) => i.key === vehicleKey.value);
  if (!i) return;
  emit("change", {
    vehicles: [
      ...(props.role.vehicles || []),
      { uid: crypto.randomUUID(), key: i.key, sdp: i.facts.sdp, upgrades: "" },
    ],
  });
}
function changeVehicle(vehicle, patch) {
  emit("change", {
    vehicles: props.role.vehicles.map((v) =>
      v.uid === vehicle.uid ? { ...v, ...patch } : v,
    ),
  });
}
</script>
