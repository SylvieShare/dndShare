<template>
  <div class="scene-combat-editor">
    <div v-if="creatures.length" class="scene-combat-editor-list">
      <div v-for="(creature, index) in creatures" :key="creatureKey(creature, index)" class="scene-combat-editor-row">
        <span class="scene-combat-editor-kind" :title="creature.kind === 'handbook' ? 'Из бестиария' : 'Упрощённое существо'">
          <ItemIcon v-if="creature.kind === 'handbook'" :item="itemById(creature.itemId)" :size="30" placeholder />
          <span v-else class="scene-combat-editor-placeholder"><Sparkles :size="15" /></span>
        </span>
        <div class="scene-combat-editor-copy">
          <strong>{{ creature.name || 'Существо' }}</strong>
          <small v-if="creature.kind === 'simple'">КБ {{ creature.ac || 0 }} · HP {{ creature.hpMax || creature.hp || 0 }}</small>
          <small v-else>Бестиарий</small>
        </div>
        <FormNumberInput :value="creature.count || 1" :min="1" :max="20" @change="setCount(index, $event)" />
        <button type="button" class="scene-combat-editor-remove" aria-label="Удалить существо" @click="remove(index)"><Trash2 :size="16" /></button>
      </div>
    </div>
    <div v-else class="scene-combat-editor-empty">
      Добавьте существ, которых нужно подготовить к этой сцене.
    </div>

    <div class="scene-combat-editor-actions">
      <button type="button" @click="pickerOpen = true"><BookOpen :size="17" />Из бестиария</button>
      <button type="button" @click="simpleOpen = true"><Plus :size="17" />Создать упрощённо</button>
    </div>

    <ItemPickerModal
      v-if="pickerOpen"
      :item-type-ids="[6]"
      :z-index="3200"
      title="Бестиарий"
      search-placeholder="Поиск существ..."
      allow-quantity
      create-show-name-en
      @close="pickerOpen = false"
      @pick="addHandbook"
    />

    <AppModalFrame v-if="simpleOpen" title="Упрощённое существо" :z-index="3200" @close="closeSimple">
      <FormField label="Имя" vertical>
        <FormTextInput v-model:value="simpleDraft.name" placeholder="Гоблин-вожак" autofocus @enter="saveSimple" />
      </FormField>
      <div class="scene-combat-editor-stats">
        <FormField label="Класс брони" vertical>
          <FormNumberInput :value="simpleDraft.ac" :min="0" :max="99" @change="simpleDraft.ac = $event" />
        </FormField>
        <FormField label="Текущие HP" vertical>
          <FormNumberInput :value="simpleDraft.hp" :min="0" :max="9999" @change="setSimpleHp" />
        </FormField>
        <FormField label="Максимум HP" vertical>
          <FormNumberInput :value="simpleDraft.hpMax" :min="0" :max="9999" @change="simpleDraft.hpMax = $event" />
        </FormField>
        <FormField label="Количество" vertical>
          <FormNumberInput :value="simpleDraft.count" :min="1" :max="20" @change="simpleDraft.count = $event" />
        </FormField>
      </div>
      <FormField label="Описание" vertical>
        <FormTextarea v-model:value="simpleDraft.description" :rows="3" :maxlength="2000" placeholder="Краткое описание" />
      </FormField>
      <template #footer>
        <FormActionButtons
          submit-text="Добавить"
          :can-submit="!!simpleDraft.name.trim()"
          @cancel="closeSimple"
          @submit="saveSimple"
        />
      </template>
    </AppModalFrame>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { BookOpen, Plus, Sparkles, Trash2 } from '@lucide/vue'
import { AppModalFrame } from '@sylvieshare/share-ui'
import { FormActionButtons } from '@sylvieshare/share-ui'
import { FormField } from '@sylvieshare/share-ui'
import { FormNumberInput } from '@sylvieshare/share-ui'
import { FormTextInput } from '@sylvieshare/share-ui'
import { FormTextarea } from '@sylvieshare/share-ui'
import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import { useItemReferenceMap } from '@/features/sessions/composables/useItemReferenceMap'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue'])
const pickerOpen = ref(false)
const simpleOpen = ref(false)
const simpleDraft = reactive({ name: '', ac: 0, hp: 0, hpMax: 0, description: '', count: 1 })

const creatures = computed(() => props.modelValue)
const itemIds = computed(() => props.modelValue
  .filter(creature => creature.kind === 'handbook')
  .map(creature => creature.itemId))
const { itemById } = useItemReferenceMap(itemIds)

function normalizedCount(value) {
  return Math.max(1, Math.min(20, Math.floor(Number(value) || 1)))
}

function creatureKey(creature, index) {
  return creature.id || `${creature.kind}:${creature.itemId ?? creature.name}:${index}`
}

function replace(next) {
  emit('update:modelValue', next)
}

function addHandbook(item, count) {
  const next = props.modelValue.map(creature => ({ ...creature }))
  const existing = next.find(creature => creature.kind === 'handbook' && String(creature.itemId) === String(item.id))
  if (existing) existing.count = normalizedCount((existing.count || 1) + normalizedCount(count))
  else next.push({ kind: 'handbook', itemId: item.id, name: item.name || 'Существо', count: normalizedCount(count) })
  replace(next)
}

function setCount(index, count) {
  replace(props.modelValue.map((creature, creatureIndex) => creatureIndex === index
    ? { ...creature, count: normalizedCount(count) }
    : creature))
}

function remove(index) {
  replace(props.modelValue.filter((_, creatureIndex) => creatureIndex !== index))
}

function setSimpleHp(value) {
  simpleDraft.hp = value
  if (!simpleDraft.hpMax || simpleDraft.hpMax < value) simpleDraft.hpMax = value
}

function closeSimple() {
  simpleOpen.value = false
  resetSimple()
}

function resetSimple() {
  Object.assign(simpleDraft, { name: '', ac: 0, hp: 0, hpMax: 0, description: '', count: 1 })
}

function saveSimple() {
  const name = simpleDraft.name.trim()
  if (!name) return
  replace([...props.modelValue, {
    id: `simple-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: 'simple',
    name,
    ac: Math.max(0, Math.floor(Number(simpleDraft.ac) || 0)),
    hp: Math.max(0, Math.floor(Number(simpleDraft.hp) || 0)),
    hpMax: Math.max(
      Math.max(0, Math.floor(Number(simpleDraft.hp) || 0)),
      Math.max(0, Math.floor(Number(simpleDraft.hpMax) || 0)),
    ),
    description: simpleDraft.description.trim(),
    count: normalizedCount(simpleDraft.count),
  }])
  simpleOpen.value = false
  resetSimple()
}
</script>

<style scoped>
.scene-combat-editor { display: flex; flex-direction: column; gap: 12px; }
.scene-combat-editor-list { display: flex; flex-direction: column; gap: 7px; }
.scene-combat-editor-row {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto 34px;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface-raised);
}
.scene-combat-editor-kind { width: 30px; height: 30px; display: grid; place-items: center; color: var(--danger); }
.scene-combat-editor-placeholder { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 7px; background: color-mix(in srgb, var(--danger) 10%, var(--surface)); color: var(--danger); }
.scene-combat-editor-copy { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.scene-combat-editor-copy strong { overflow: hidden; color: var(--text-1); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.scene-combat-editor-copy small { color: var(--text-muted); font-size: 10px; }
.scene-combat-editor-remove { width: 32px; height: 32px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 7px; background: none; color: var(--text-muted); cursor: pointer; }
.scene-combat-editor-remove:hover { background: color-mix(in srgb, var(--danger) 10%, transparent); color: var(--danger); }
.scene-combat-editor-empty { padding: 16px; border: 1px dashed var(--border-strong); border-radius: 9px; color: var(--text-muted); font-size: 12px; text-align: center; }
.scene-combat-editor-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.scene-combat-editor-actions button { display: inline-flex; align-items: center; gap: 7px; padding: 8px 11px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-raised); color: var(--text-2); font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
.scene-combat-editor-actions button:hover { border-color: var(--danger); color: var(--danger); }
.scene-combat-editor-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
@media (max-width: 560px) {
  .scene-combat-editor-row { grid-template-columns: 22px minmax(0, 1fr) auto; }
  .scene-combat-editor-row :deep(.fn-wrap) { grid-column: 2; }
  .scene-combat-editor-remove { grid-column: 3; grid-row: 1 / span 2; }
  .scene-combat-editor-stats { grid-template-columns: 1fr; }
}
</style>
