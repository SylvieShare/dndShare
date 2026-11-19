<template>
  <div class="red-section">
    <h3>Медицина</h3>
    <p>
      Хирургия {{ 2 * (role.choices?.surgery || 0) }} · Медицинские технологии
      {{
        (role.choices?.pharmaceuticals || 0) + (role.choices?.cryosystem || 0)
      }}
    </p>
    <div class="red-actions">
      <ActionButton
        @click="
          emit('roll', { kind: 'medicine', mode: 'surgery', title: 'Хирургия' })
        "
        >Хирургия</ActionButton
      ><ActionButton
        @click="
          emit('roll', {
            kind: 'medicine',
            mode: 'medical-tech',
            title: 'Медицинские технологии',
          })
        "
        >Медицинские технологии</ActionButton
      >
    </div>
    <h3>
      Изученные рецепты · {{ known.length }} /
      {{ role.choices?.pharmaceuticals || 0 }}
    </h3>
    <div v-for="recipe in medicines" :key="recipe.key" class="red-list-item">
      <strong>{{ recipe.name }}</strong
      ><small>{{ recipe.description }}</small>
      <div class="red-actions">
        <ActionButton
          v-if="editable"
          :disabled="
            !known.includes(recipe.key) &&
            known.length >= (role.choices?.pharmaceuticals || 0)
          "
          @click="toggle(recipe.key)"
          >{{
            known.includes(recipe.key) ? "Изучен · убрать" : "Изучить"
          }}</ActionButton
        ><ActionButton
          v-if="known.includes(recipe.key)"
          :disabled="!editable"
          @click="
            emit('roll', {
              kind: 'manufacture-medicine',
              entryUid: recipe.key,
              title: 'Изготовление: ' + recipe.name,
            })
          "
          >Изготовить · <EurodollarAmount :amount="200" /></ActionButton
        >
      </div>
    </div>
    <small
      >Партия занимает час. При успехе DV 13 число доз равно рангу Медицинских
      технологий; материалы расходуются и при провале.</small
    >
  </div>
</template>
<script setup>
import EurodollarAmount from '@/shared/ui/EurodollarAmount.vue'
import { computed } from "vue";
import { ActionButton } from "@sylvieshare/share-ui";
const props = defineProps({ role: Object, items: Array, editable: Boolean }),
  emit = defineEmits(["change", "roll"]);
const medicines = computed(() =>
    props.items.filter((i) => i.kind === "pharmaceutical"),
  ),
  known = computed(() => props.role.choices?.knownRecipes || []);
function toggle(key) {
  const next = known.value.includes(key)
    ? known.value.filter((k) => k !== key)
    : [...known.value, key];
  emit("change", { choices: { ...props.role.choices, knownRecipes: next } });
}
</script>
