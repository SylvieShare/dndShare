<template>
  <div class="red-stack">
    <IllustratedChoiceStage v-if="step === 'method'" class="method-stage" title="Способ создания" two-column>
      <template #cards>
        <BackgroundSelectCard
          v-for="method in methods"
          :key="method.key"
          :title="method.name"
          :description="method.description"
          :monogram="method.name[0]"
          :image-url="art.methodCover(method.key)"
          :selected="draft.method === method.key"
          :expanded-selection="false"
          panoramic
          @select="emit('method', method.key)"
        />
      </template>
    </IllustratedChoiceStage>
    <IllustratedChoiceStage
      v-else-if="step === 'role'"
      title="Роль"
      :selected="roleExpanded"
      :selection-key="roleExpanded ? draft.role : null"
      back-text="К выбору роли"
      two-column
      @clear="emit('browse-roles')"
    >
      <template #cards>
        <BackgroundSelectCard
          v-for="role in visibleRoles"
          :key="role.key"
          :title="role.name"
          :description="roleItem(role.key)?.description || role.originalName"
          :monogram="role.name[0]"
          :image-url="roleItem(role.key)?.coverImageUrl || art.collectionCover('Роли')"
          :selected="draft.role === role.key"
          :expanded-selection="roleExpanded"
          panoramic
          @select="emit('role', role.key)"
        />
      </template>
      <template #details>
        <div v-if="roleFields[draft.role]" class="red-panel">
          <h3>Специальности роли</h3>
          <div class="red-form-grid">
            <FormField
              v-for="[key, name] in roleFields[draft.role]"
              :key="key"
              :label="name"
              vertical
            >
              <FormNumberInput
                :value="draft.roleChoices[key] || 0"
                :min="0"
                :max="4"
                @change="patch({ roleChoices: { ...draft.roleChoices, [key]: $event } })"
              />
            </FormField>
          </div>
          <small>Всего очков: {{ draft.role === "tech" ? 8 : 4 }}</small>
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
        </div>
      </template>
    </IllustratedChoiceStage>
    <template v-else-if="step === 'lifepath'"
      ><RedCreationIntro title="Жизненный путь" :cover="art.dictionaryCover('Местности')" />
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
    <RedCreationStats
      v-else-if="step === 'stats'"
      :method="draft.method"
      :role="draft.role"
      :stats="draft.stats"
      :rolls="draft.statRolls"
      :art="art"
      @patch="patch"
      @roll="emit('roll-stats')"
    />
    <template v-else-if="step === 'skills'"
      ><RedCreationIntro title="Навыки" :cover="art.dictionaryCover('Навыки')" />
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
        :allowed-keys="draft.method === 'edgerunner' ? RED_ROLE_SKILLS[draft.role].map(skill => skill.key) : null"
        @patch="patch"
      />
      <p
        v-for="e in validation.errors.filter((e) =>
          e.path.startsWith('skills'),
        )"
        :key="JSON.stringify(e)"
        class="red-danger"
      >
        {{ redCreationErrorText(e) }}
      </p></template
    >
    <RedCreationShop
      v-else-if="step === 'equipment' || step === 'cyberware'"
      :draft="draft"
      :items="items"
      :summary="shopping"
      :cyber="step === 'cyberware'"
      :cover="art.collectionCover(step === 'cyberware' ? 'Киберимпланты' : 'Снаряжение')"
      @patch="patch"
    />
    <template v-else
      ><RedCreationIntro
        title="Готовность персонажа"
        :cover="roleItem(draft.role)?.coverImageUrl || art.collectionCover('Роли')"
      />
      <FormField label="Имя / handle" vertical
        ><FormTextInput
          :value="draft.name"
          @update:value="patch({ name: $event })"
      /></FormField>
      <p>
        {{ RED_ROLES.find((r) => r.key === draft.role)?.name }} · ранг 4 ·
        {{ methods.find(method => method.key === draft.method)?.name }}
      </p>
      <p>
        Остаток денег: {{ shopping.cash }} eb. Неиспользованные деньги на одежду
        не переносятся.
      </p></template
    >
  </div>
</template>
<script setup>
import { computed } from "vue";
import {
  ActionButton,
  FormField,
  FormTextInput,
  FormNumberInput,
} from "@sylvieshare/share-ui";
import {
  RED_ROLES,
} from "@/features/character-editor/settings/cyberpunk-red/catalogue";
import { RED_ROLE_SKILLS } from "@/features/character-editor/settings/cyberpunk-red/creationTables";
import {
  RED_LIFEPATH_FIELDS,
  RED_ROLE_LIFEPATH,
} from "@/features/character-editor/settings/cyberpunk-red/lifepath";
import RedSkills from "@/features/character-editor/components/sheet/cyberpunk-red/RedSkills.vue";
import BackgroundSelectCard from "../BackgroundSelectCard.vue";
import IllustratedChoiceStage from "../IllustratedChoiceStage.vue";
import RedCreationStats from "./RedCreationStats.vue";
import RedCreationIntro from "./RedCreationIntro.vue";
import RedCreationShop from "./RedCreationShop.vue";
import { redCreationErrorText } from "../../../composables/redCreationStepValidation";
const props = defineProps({
  draft: Object,
  step: String,
  roleExpanded: Boolean,
  items: Array,
  art: { type: Object, required: true },
  validation: Object,
  shopping: Object,
  skillValues: Object,
});
const emit = defineEmits([
  "patch",
  "method",
  "role",
  "browse-roles",
  "roll-stats",
  "native-language",
  "specialization",
]);
const roleItems = computed(() => new Map(
  props.items.filter(item => item.kind === "role").map(item => [item.key, item]),
));
const roleItem = key => roleItems.value.get(`role-${key}`);
const visibleRoles = computed(() => props.roleExpanded
  ? RED_ROLES.filter(role => role.key === props.draft.role)
  : RED_ROLES);
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
</script>

<style scoped>
@media (min-width: 1050px) {
  .method-stage :deep(.illustrated-choice-list--two-column) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
