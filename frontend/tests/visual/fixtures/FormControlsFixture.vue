<template>
  <main class="fixture-card" data-testid="form-controls">
    <h1>Поля окна морфа</h1>
    <label>
      Название
      <FormTextInput v-model:value="text" placeholder="Например, боевой стиль" />
    </label>
    <label>
      Значение
      <FormNumberInput :value="number" @change="number = $event" />
    </label>
    <label>
      Характеристика
      <ValueSelect v-model="selected" :options="options" placeholder="Выберите характеристику" />
    </label>
    <label>
      Описание
      <FormTextarea v-model:value="description" placeholder="Дополнительное описание" />
    </label>
    <ToggleSwitch v-model="enabled" label="Показывать в листе" />
  </main>
</template>

<script setup>
import { ref } from 'vue'
import FormNumberInput from '../../../src/shared/ui/form/FormNumberInput.vue'
import FormTextInput from '../../../src/shared/ui/form/FormTextInput.vue'
import FormTextarea from '../../../src/shared/ui/form/FormTextarea.vue'
import ToggleSwitch from '../../../src/shared/ui/ToggleSwitch.vue'
import ValueSelect from '../../../src/shared/ui/ValueSelect.vue'

const enabled = ref(false)
const selected = ref(null)
const text = ref('')
const number = ref(12)
const description = ref('')
const options = [
  { value: 'strength', label: 'Сила' },
  { value: 'dexterity', label: 'Ловкость' },
]
</script>

<style scoped>
.fixture-card {
  width: 420px;
  display: grid;
  gap: 18px;
  padding: 28px;
  border: 1px solid var(--border-strong);
  border-radius: 14px;
  background: var(--block-bg);
  box-shadow: var(--shadow-lg);
  --control-bg: var(--bg-deep);
}

.fixture-card h1 {
  margin: 0 0 4px;
  font-size: 22px;
}

.fixture-card label {
  display: grid;
  gap: 7px;
  color: var(--text-2);
  font-size: 13px;
}
</style>
