<template>
  <div class="red-stack">
    <BaseTile :outlined="false"
      ><div class="red-panel">
        <h2>Развитие</h2>
        <FormField label="Доступно IP" vertical
          ><FormNumberInput
            v-if="editable"
            :value="values.progression.ipAvailable"
            :min="0"
            @change="
              emit('patch', {
                progression: { ...values.progression, ipAvailable: $event },
              })
            "
          /><strong v-else>{{
            values.progression.ipAvailable
          }}</strong></FormField
        ><small
          >Потрачено: {{ values.progression.ipSpent }} IP. Каждый новый ранг
          покупается отдельно.</small
        >
        <p v-if="error" role="alert" class="red-danger">{{ error }}</p>
        <div v-if="editable" class="red-actions">
          <FormSelect v-model:value="skillUid"
            ><option value="">Выбрать навык</option>
            <option v-for="s in values.skills" :key="s.uid" :value="s.uid">
              {{ RED_SKILLS_BY_KEY[s.key]?.name }} {{ s.specialization }} ·
              {{ s.rank }} → {{ s.rank + 1 }}
            </option></FormSelect
          ><ActionButton
            :disabled="!skillUid"
            @click="advance({ kind: 'skill', uid: skillUid })"
            >Повысить навык</ActionButton
          >
        </div>
      </div></BaseTile
    >
    <BaseTile v-for="role in values.roles" :key="role.uid" :outlined="false"
      ><div class="red-panel">
        <div class="red-row">
          <h2>{{ roleName(role.key) }} · {{ role.rank }}</h2>
          <ActionButton
            v-if="editable"
            :disabled="role.rank >= 10"
            @click="advance({ kind: 'role', uid: role.uid })"
            >Повысить · {{ (role.rank + 1) * 60 }} IP</ActionButton
          >
        </div>
        <p>{{ descriptions[role.key] }}</p>
        <div v-if="fields[role.key]" class="red-form-grid">
          <FormField
            v-for="[key, label] in fields[role.key]"
            :key="key"
            :label="label"
            vertical
            ><FormNumberInput
              v-if="editable"
              :value="role.choices?.[key] || 0"
              :min="0"
              :max="
                role.key === 'tech'
                  ? role.rank
                  : role.key === 'medtech'
                    ? 5
                    : role.rank
              "
              @change="setChoice(role, key, $event)"
            /><strong v-else>{{ role.choices?.[key] || 0 }}</strong></FormField
          >
        </div>
        <small v-if="role.key === 'tech'"
          >При каждом ранге Maker получают по очку две разные
          специальностями.</small
        ><small v-if="role.key === 'medtech'"
          >По одному очку Medicine на ранг. Surgery даёт 2 пункта за вложенное
          очко.</small
        >
        <ActionButton
          v-if="['rockerboy', 'lawman'].includes(role.key)"
          @click="
            emit('roll', {
              kind: 'role',
              roleKey: role.key,
              title: roleName(role.key),
            })
          "
          >Проверка способности</ActionButton
        >
        <RedRoleTools
          :role="role"
          :values="values"
          :items="items"
          :editable="editable"
          @change="saveRole(role, $event)"
          @roll="emit('roll', $event)"
        /><ActionButton
          v-if="role.key === 'media'"
          @click="
            emit('roll', {
              kind: 'role',
              roleKey: 'media',
              mode: 'publication',
              title: 'Достоверность публикации',
            })
          "
          >Достоверность публикации</ActionButton
        ><RedMedicine
          v-if="role.key === 'medtech'"
          :role="role"
          :items="items"
          :editable="editable"
          @change="saveRole(role, $event)"
          @roll="emit('roll', $event)"
        /><FormField label="Связи, ресурсы и особенности роли" vertical
          ><FormTextarea
            v-if="editable"
            :value="role.notes || ''"
            @update:value="saveRole(role, { notes: $event })"
          />
          <p v-else>{{ role.notes || "Нет записей" }}</p></FormField
        >
      </div></BaseTile
    >
    <BaseTile v-if="editable" :outlined="false"
      ><div class="red-panel">
        <h2>Новая роль</h2>
        <FormSelect v-model:value="newRole"
          ><option value="">Выбрать роль</option>
          <option v-for="r in available" :key="r.key" :value="r.key">
            {{ r.name }}
          </option></FormSelect
        ><ActionButton
          :disabled="!newRole"
          @click="advance({ kind: 'role', key: newRole })"
          >Купить ранг 1 · 60 IP</ActionButton
        ><small>Последняя освоенная роль должна иметь ранг не ниже 4.</small>
      </div></BaseTile
    >
  </div>
</template>
<script setup>
import RedRoleTools from "./RedRoleTools.vue";
import RedMedicine from "./RedMedicine.vue";
import { computed, ref } from "vue";
import {
  BaseTile,
  FormField,
  FormNumberInput,
  FormSelect,
  FormTextarea,
  ActionButton,
} from "@sylvieshare/share-ui";
import {
  RED_ROLES,
  RED_SKILLS_BY_KEY,
} from "../../../settings/cyberpunk-red/catalogue";
import {
  redAdvance,
  redSoloAllocation,
} from "../../../settings/cyberpunk-red/gameplay";
const props = defineProps({ values: Object, items: Array, editable: Boolean });
const emit = defineEmits(["patch", "roll"]);
const error = ref(""),
  skillUid = ref(""),
  newRole = ref("");
const available = computed(() =>
  RED_ROLES.filter((r) => !props.values.roles.some((v) => v.key === r.key)),
);
const roleName = (key) => RED_ROLES.find((r) => r.key === key)?.name || key;
const fields = {
  solo: [
    ["damageDeflection", "Отражение урона · 2 очка"],
    ["fumbleRecovery", "Восстановление после промаха · 4 очка"],
    ["initiative", "Инициатива · 1 очко"],
    ["precisionAttack", "Точная атака · 3 очка"],
    ["spotWeakness", "Слабое место · 1 очко"],
    ["threatDetection", "Обнаружение угроз · 1 очко"],
  ],
  tech: [
    ["field", "Полевая экспертиза"],
    ["upgrade", "Модернизация"],
    ["fabrication", "Изготовление"],
    ["invention", "Изобретение"],
  ],
  medtech: [
    ["surgery", "Хирургия"],
    ["pharmaceuticals", "Фармацевтика"],
    ["cryosystem", "Криосистемы"],
  ],
};
import { RED_ROLE_DESCRIPTIONS as descriptions } from "../../../settings/cyberpunk-red/roleInfo";
function advance(spec) {
  try {
    error.value = "";
    const v = redAdvance(props.values, spec);
    emit("patch", {
      skills: v.skills,
      roles: v.roles,
      progression: v.progression,
    });
  } catch (e) {
    error.value = e.message;
  }
}
function saveRole(role, patch) {
  emit("patch", {
    roles: props.values.roles.map((r) =>
      r.uid === role.uid ? { ...r, ...patch } : r,
    ),
  });
}
function setChoice(role, key, value) {
  try {
    error.value = "";
    const choices = { ...role.choices, [key]: value };
    if (role.key === "solo") redSoloAllocation(role.rank, choices);
    else if (
      fields[role.key].reduce((n, [k]) => n + Number(choices[k] || 0), 0) >
      role.rank * (role.key === "tech" ? 2 : 1)
    )
      throw new Error("Превышено число очков специальностей");
    if (
      role.key === "medtech" &&
      (choices.knownRecipes || []).length > (choices.pharmaceuticals || 0)
    )
      throw new Error("Сначала уберите лишние рецепты");
    saveRole(role, { choices });
  } catch (e) {
    error.value = e.message;
  }
}
</script>
