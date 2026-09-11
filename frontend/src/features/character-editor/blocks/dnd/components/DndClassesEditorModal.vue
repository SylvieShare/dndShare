<template>
  <AppModalFrame title="Классы и уровни" subtitle="Ручное редактирование" :z-index="3200" @close="$emit('close')">
    <div class="manual-classes">
      <BaseTile class="manual-classes-warning" color="var(--warning)" tint>
        <strong>Сохраните последовательность развития персонажа</strong>
        <p>Для обычного повышения используйте блок уровня: он проведёт вас через получение новых возможностей.
          Ручная правка меняет только классы, подклассы и их уровни. Полученные способности, хиты и заклинания
          не пересчитываются — они могут перестать соответствовать прогрессии персонажа.</p>
      </BaseTile>

      <LoadingIndicator v-if="loading" label="Загрузка классов…" />
      <div v-else-if="loadError" role="alert">
        <p>{{ loadError }}</p>
        <ActionButton variant="secondary" @click="load">Повторить загрузку</ActionButton>
      </div>
      <template v-else>
        <BaseTile v-for="(row, index) in rows" :key="row.key" class="manual-class">
          <div class="manual-class-heading">
            <span>Класс {{ index + 1 }}</span>
            <RemoveButton icon="trash" :label="`Удалить класс ${row.name || index + 1}`" @click="remove(row)" />
          </div>
          <FormField label="Класс" vertical>
            <ValueSelect :model-value="row.id" :options="classOptions(row)" placeholder="Выберите класс"
              aria-label="Класс" searchable search-placeholder="Найти класс" empty-label="Классы не найдены"
              @update:model-value="changeClass(row, $event)" />
          </FormField>
          <FormField label="Подкласс" vertical>
            <ValueSelect :model-value="row.subclass?.id || ''" :options="subclassOptions(row)" :disabled="!row.id"
              aria-label="Подкласс" placeholder="Без подкласса" @update:model-value="changeSubclass(row, $event)" />
          </FormField>
          <FormField label="Уровень класса">
            <FormNumberInput :value="row.level" :min="1" :max="20" @change="row.level = $event" />
          </FormField>
        </BaseTile>
        <AddButton block @click="add">Добавить класс</AddButton>
        <div class="manual-classes-total"><span>Общий уровень</span><strong>{{ total }}</strong></div>
        <p v-if="validation" class="manual-classes-error" role="alert">{{ validation }}</p>
      </template>
    </div>
    <template #footer>
      <FormActionButtons submit-text="Сохранить" cancel-text="Отменить" :can-submit="canSave"
        @submit="save" @cancel="$emit('close')" />
    </template>
  </AppModalFrame>
</template>

<script setup>
import { inject, onMounted } from 'vue'
import { ActionButton, AddButton, AppModalFrame, BaseTile, FormActionButtons, FormField, FormNumberInput, LoadingIndicator, RemoveButton, ValueSelect } from '@sylvieshare/share-ui'
import { useManualClassEditor } from './useManualClassEditor'

const props = defineProps({ values: { type: Object, required: true } })
const emit = defineEmits(['apply', 'close'])
const charCtx = inject('charCtx', {})
const { rows, loading, loadError, total, validation, canSave, load, classOptions, subclassOptions, changeClass, changeSubclass, add, remove, updates } = useManualClassEditor(() => props.values, charCtx)
onMounted(load)

function save() {
  const result = updates()
  if (result) emit('apply', result)
}
</script>

<style scoped>
.manual-classes { display: flex; flex-direction: column; gap: 16px; }
.manual-classes-warning { padding: 14px; font-size: 13px; line-height: 1.55; }
.manual-classes-warning strong { color: var(--text-1); }
.manual-classes-warning p { margin: 6px 0 0; color: var(--text-2); }
.manual-class { display: flex; flex-direction: column; gap: 12px; padding: 14px; }
.manual-class-heading, .manual-classes-total { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.manual-class-heading { color: var(--text-muted); font-size: 12px; }
.manual-classes-total { color: var(--text-2); }
.manual-classes-total strong { color: var(--text-1); font-size: 24px; font-variant-numeric: tabular-nums; }
.manual-classes-error { margin: 0; color: var(--danger); font-size: 13px; }
</style>
