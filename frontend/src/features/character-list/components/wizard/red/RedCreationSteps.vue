<template>
  <div class="red-stack">
    <template v-if="step === 0"
      ><h2>Способ создания</h2>
      <div class="red-form-grid">
        <ChoiceCard
          v-for="m in methods"
          :key="m.key"
          :label="m.name"
          :description="m.description"
          :model-value="draft.method === m.key"
          @update:model-value="emit('method', m.key)"
        />
      </div>
      <p>Cyberpunk RED · Core 1.25 · 2045 год</p></template
    >
    <template v-else-if="step === 1"
      ><h2>Роль</h2>
      <div class="red-form-grid">
        <ChoiceCard
          v-for="r in RED_ROLES"
          :key="r.key"
          :label="r.name"
          :description="r.originalName + ' · начальный ранг 4'"
          :model-value="draft.role === r.key"
          @update:model-value="emit('role', r.key)"
        />
      </div>
      <div v-if="roleFields[draft.role]" class="red-panel">
        <h3>Специальности роли</h3>
        <FormField
          v-for="[key, name] in roleFields[draft.role]"
          :key="key"
          :label="name"
          vertical
          ><FormNumberInput
            :value="draft.roleChoices[key] || 0"
            :min="0"
            :max="4"
            @change="
              patch({ roleChoices: { ...draft.roleChoices, [key]: $event } })
            " /></FormField
        ><small>Всего очков: {{ draft.role === "tech" ? 8 : 4 }}</small>
      </div>
      <div v-if="draft.role === 'medtech'" class="red-panel">
        <h3>
          Рецепты · {{ draft.roleChoices.knownRecipes?.length || 0 }} /
          {{ draft.roleChoices.pharmaceuticals || 0 }}
        </h3>
        <div class="red-actions">
          <ActionButton
            v-for="i in items.filter((i) => i.kind === 'pharmaceutical')"
            :key="i.key"
            :variant="
              draft.roleChoices.knownRecipes?.includes(i.key)
                ? 'primary'
                : 'quiet'
            "
            @click="toggleRecipe(i.key)"
            >{{ i.name }}</ActionButton
          >
        </div>
      </div></template
    >
    <template v-else-if="step === 2"
      ><h2>Жизненный путь</h2>
      <div class="red-form-grid">
        <FormField label="Родной язык · бесплатный ранг 4" vertical
          ><FormTextInput
            :value="draft.nativeLanguage"
            @update:value="emit('native-language', $event)" /></FormField
        ><FormField
          v-for="[key, label] in RED_LIFEPATH_FIELDS"
          :key="key"
          :label="label"
          vertical
          ><FormTextInput
            :value="draft.lifepath[key] || ''"
            @update:value="
              patch({ lifepath: { ...draft.lifepath, [key]: $event } })
            "
        /></FormField>
      </div>
      <h3>Путь роли</h3>
      <div class="red-form-grid">
        <FormField
          v-for="[key, label] in RED_ROLE_LIFEPATH[draft.role]"
          :key="key"
          :label="label"
          vertical
          ><FormTextInput
            :value="draft.roleLifepath[key] || ''"
            @update:value="
              patch({ roleLifepath: { ...draft.roleLifepath, [key]: $event } })
            "
        /></FormField></div
    ></template>
    <template v-else-if="step === 3"
      ><h2>Характеристики</h2>
      <p v-if="draft.method === 'complete'">
        Распределено {{ statTotal }} из 62. Каждое значение от 2 до 8.
      </p>
      <div v-else class="red-actions">
        <ActionButton @click="emit('roll-stats')">{{
          draft.method === "streetrat"
            ? "Бросить d10 для набора"
            : "Бросить 10d10 по характеристикам"
        }}</ActionButton
        ><small>Результаты: {{ draft.statRolls.join(", ") }}</small>
      </div>
      <div class="red-form-grid">
        <FormField
          v-for="s in RED_STATS"
          :key="s.key"
          :label="`${s.name} · ${s.key}`"
          vertical
          ><FormNumberInput
            v-if="draft.method === 'complete'"
            :value="draft.stats[s.key]"
            :min="2"
            :max="8"
            @change="patch({ stats: { ...draft.stats, [s.key]: $event } })"
          /><strong v-else class="red-metric">{{
            draft.stats[s.key]
          }}</strong></FormField
        >
      </div></template
    >
    <template v-else-if="step === 4"
      ><h2>Навыки</h2>
      <p>
        Стоимость: {{ validation.skills?.spent || 0 }} / 86. Родной язык 4 не
        расходует очки.
      </p>
      <div class="red-form-grid">
        <FormField
          v-for="key in ['science', 'play-instrument']"
          :key="key"
          :label="
            key === 'science' ? 'Специализация науки' : 'Музыкальный инструмент'
          "
          vertical
          ><FormTextInput
            :value="draft.specializations[key] || ''"
            @update:value="emit('specialization', { key, value: $event })"
        /></FormField>
      </div>
      <RedSkills
        creation
        :values="skillValues"
        :items="[]"
        :editable="draft.method !== 'streetrat'"
        @patch="patch"
      />
      <p
        v-for="e in validation.errors.filter((e) =>
          e.path.startsWith('skills'),
        )"
        :key="JSON.stringify(e)"
        class="red-danger"
      >
        {{ errorText(e) }}
      </p></template
    >
    <RedCreationShop
      v-else-if="step === 5 || step === 6"
      :draft="draft"
      :items="items"
      :summary="shopping"
      :cyber="step === 6"
      @patch="patch"
    />
    <template v-else
      ><h2>Готовность персонажа</h2>
      <FormField label="Имя / handle" vertical
        ><FormTextInput
          :value="draft.name"
          @update:value="patch({ name: $event })"
      /></FormField>
      <p>
        {{ RED_ROLES.find((r) => r.key === draft.role)?.name }} · ранг 4 ·
        {{ draft.method }}
      </p>
      <p>
        Остаток денег: {{ shopping.cash }} eb. Неиспользованные деньги на одежду
        не переносятся.
      </p>
      <p
        v-for="e in validation.errors"
        :key="JSON.stringify(e)"
        class="red-danger"
      >
        {{ errorText(e) }}
      </p></template
    >
  </div>
</template>
<script setup>
import { computed } from "vue";
import {
  ActionButton,
  ChoiceCard,
  FormField,
  FormTextInput,
  FormNumberInput,
} from "@sylvieshare/share-ui";
import {
  RED_ROLES,
  RED_STATS,
} from "@/features/character-editor/settings/cyberpunk-red/catalogue";
import {
  RED_LIFEPATH_FIELDS,
  RED_ROLE_LIFEPATH,
} from "@/features/character-editor/settings/cyberpunk-red/lifepath";
import RedSkills from "@/features/character-editor/components/sheet/cyberpunk-red/RedSkills.vue";
import RedCreationShop from "./RedCreationShop.vue";
const props = defineProps({
  draft: Object,
  step: Number,
  items: Array,
  validation: Object,
  shopping: Object,
  skillValues: Object,
});
const emit = defineEmits([
  "patch",
  "method",
  "role",
  "roll-stats",
  "native-language",
  "specialization",
]);
const patch = (value) => emit("patch", value);
function toggleRecipe(key) {
  const known = props.draft.roleChoices.knownRecipes || [];
  patch({
    roleChoices: {
      ...props.draft.roleChoices,
      knownRecipes: known.includes(key)
        ? known.filter((k) => k !== key)
        : [...known, key],
    },
  });
}
const statTotal = computed(() =>
  Object.values(props.draft.stats).reduce((a, b) => a + b, 0),
);
const methods = [
  {
    key: "streetrat",
    name: "Уличная крыса",
    description: "Готовый набор характеристик, навыков и снаряжения.",
  },
  {
    key: "edgerunner",
    name: "Эджраннер",
    description: "Отдельные броски характеристик; навыки из списка роли.",
  },
  {
    key: "complete",
    name: "Полный пакет",
    description: "Распределение очков и самостоятельные покупки.",
  },
];
const roleFields = {
  solo: [
    ["damageDeflection", "Отражение урона · 2 очка"],
    ["fumbleRecovery", "Восстановление промаха · 4 очка"],
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
const errors = {
  "role-choice-range": "Специальность роли превышает допустимый ранг",
  "role-choice-budget": "Превышен бюджет способности роли",
  "recipe-budget": "Число рецептов превышает фармацевтическую специальность",
  "name-required": "Укажите имя",
  "native-language-required": "Выберите родной язык",
  "stat-budget": "Распределите ровно 62 очка характеристик",
  "stat-range": "Значение характеристики должно быть от 2 до 8",
  "skill-budget": "Распределите ровно 86 очков навыков",
  "skill-minimum": "Обязательный навык ниже минимума",
  "skill-range": "Начальный ранг навыка не выше 6",
  "specialization-required": "Укажите специализацию",
  "skill-not-allowed": "Навык не входит в список этой роли",
  "template-skill-mismatch": "Навык отличается от шаблона роли",
  "duplicate-skill": "Повтор навыка или специализации",
};
const errorText = (e) =>
  `${errors[e.code] || "Проверьте выбор"}${e.key ? `: ${e.key}` : ""}${e.expected != null ? ` (${e.actual} / ${e.expected})` : ""}`;
</script>
