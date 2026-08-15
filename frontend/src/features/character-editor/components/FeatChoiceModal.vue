<template>
  <AppModalFrame wide :title="item.name" subtitle="Настройка черты" :z-index="4600" @close="$emit('close')">
    <div class="fcm">
      <p class="fcm-intro">Сделайте обязательные выборы. Они сохранятся в листе персонажа вместе с чертой.</p>

      <div class="fcm-sections">
        <section v-for="choice in choices" :key="choice.key" class="fcm-section">
          <div class="fcm-section-head">
            <div>
              <div class="fcm-label">{{ choice.text || 'Выберите вариант' }}</div>
              <div class="fcm-key">{{ choice.key }}</div>
            </div>
            <span class="fcm-count" :class="{ complete: isComplete(choice) }">
              {{ selected(choice).length }} / {{ choice.count }}
            </span>
          </div>

          <div v-if="choice.source === 'item'" class="fcm-picked-items">
            <button
              v-for="picked in selectedItems(choice)"
              :key="picked.id"
              type="button"
              class="fcm-picked"
              @click="remove(choice, picked.id)"
            >
              <span>{{ picked.name }}</span><b>×</b>
            </button>
            <button
              v-if="selected(choice).length < choice.count"
              type="button"
              class="fcm-open-picker"
              @click="openItemChoice(choice)"
            >+ Выбрать из справочника</button>
          </div>

          <div v-else class="fcm-options">
            <button
              v-for="option in optionsFor(choice)"
              :key="String(option.value)"
              type="button"
              class="fcm-option"
              :class="{ selected: isSelected(choice, option.value), disabled: optionDisabled(choice, option.value) }"
              :title="isExcluded(choice, option.value) ? 'Этот вариант уже использован в другом взятии черты' : ''"
              @click="toggle(choice, option.value)"
            >
              <span class="fcm-option-mark">
                <svg v-if="isSelected(choice, option.value)" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8.5l3 3L13 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
              <span class="fcm-option-copy">
                <b>{{ option.label }}</b>
                <small v-if="option.desc">{{ option.desc }}</small>
              </span>
            </button>
          </div>
        </section>
      </div>

    </div>

    <ItemPickerModal
      v-if="itemPicker.choice"
      :item-type-ids="[Number(itemPicker.choice.from_item_type_id)]"
      :title="itemPicker.choice.text || 'Выберите предмет'"
      :exclude-items="[...selected(itemPicker.choice), ...excluded(itemPicker.choice)]"
      :item-eligibility="itemChoiceEligibility"
      :z-index="4800"
      @pick="onItemPick"
      @close="itemPicker.choice = null"
    />
    <template #footer>
      <div class="fcm-actions">
        <button type="button" class="fcm-cancel" @click="$emit('close')">Отмена</button>
        <button type="button" class="fcm-confirm" :disabled="!complete" @click="confirm">Готово</button>
      </div>
    </template>
  </AppModalFrame>
</template>

<script setup>
import { computed, onMounted, reactive, watch } from 'vue'

import { AppModalFrame } from '@sylvieshare/share-ui'
import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
import { choiceSelectionsComplete, featChoices } from '@/features/items/lib/featRules'
import { useSuggestStore } from '@/stores/suggest'

const props = defineProps({
  item: { type: Object, required: true },
  initialChoices: { type: Object, default: () => ({}) },
  excludedChoices: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['close', 'confirm'])
const suggestStore = useSuggestStore()
const choices = computed(() => featChoices(props.item))
const selections = reactive({})
const itemNames = reactive({})
const itemPicker = reactive({ choice: null })

function initialise() {
  for (const choice of choices.value) {
    selections[choice.key] = Array.isArray(props.initialChoices?.[choice.key])
      ? [...props.initialChoices[choice.key]]
      : []
    if (choice.from_suggest_id) suggestStore.ensure(Number(choice.from_suggest_id))
  }
}

onMounted(initialise)
watch(() => props.item?.id, initialise)

function selected(choice) { return selections[choice.key] || [] }
function excluded(choice) { return Array.isArray(props.excludedChoices?.[choice.key]) ? props.excludedChoices[choice.key] : [] }
function isSelected(choice, value) { return selected(choice).some((current) => String(current) === String(value)) }
function isExcluded(choice, value) { return excluded(choice).some((current) => String(current) === String(value)) }
function isComplete(choice) { return selected(choice).length === choice.count }
const complete = computed(() => choiceSelectionsComplete(props.item, selections))

function optionsFor(choice) {
  if (choice.source === 'suggest') {
    return (suggestStore.items(Number(choice.from_suggest_id)) || []).map((option) => ({
      value: option.id,
      label: option.value,
      desc: option.desc || '',
    }))
  }
  return (choice.options || []).map((option) => ({
    value: option.value ?? option.label,
    label: option.label || option.value,
    desc: option.desc || '',
  })).filter((option) => option.value != null && option.value !== '')
}

function optionDisabled(choice, value) {
  return isExcluded(choice, value) || (!isSelected(choice, value) && selected(choice).length >= choice.count)
}

function toggle(choice, value) {
  if (isExcluded(choice, value)) return
  const current = selected(choice)
  if (isSelected(choice, value)) {
    selections[choice.key] = current.filter((entry) => String(entry) !== String(value))
  } else if (choice.count === 1) {
    selections[choice.key] = [value]
  } else if (current.length < choice.count) {
    selections[choice.key] = [...current, value]
  }
}

function remove(choice, value) {
  selections[choice.key] = selected(choice).filter((entry) => String(entry) !== String(value))
}

function selectedItems(choice) {
  return selected(choice).map((id) => ({ id, name: itemNames[id] || `#${id}` }))
}

function openItemChoice(choice) { itemPicker.choice = choice }

function parseItemFilter(raw) {
  if (!raw) return null
  try { return JSON.parse(raw) } catch { /* use key=value shorthand below */ }
  const [key, ...rest] = String(raw).split('=')
  return key && rest.length ? { [key.trim()]: rest.join('=').trim() } : null
}

function itemChoiceEligibility(item) {
  if (itemPicker.choice && isExcluded(itemPicker.choice, item.id)) {
    return { eligible: false, reasons: ['Этот вариант уже использован'] }
  }
  const filter = parseItemFilter(itemPicker.choice?.item_filter)
  if (!filter) return { eligible: true, reasons: [] }
  const matches = Object.entries(filter).every(([key, expected]) => {
    const actual = String(key).split('.').reduce((value, segment) => value?.[segment], item.data)
    const allowed = Array.isArray(expected) ? expected : [expected]
    return allowed.some((value) => String(value) === String(actual))
  })
  return { eligible: matches, reasons: matches ? [] : ['Не подходит под фильтр выбора'] }
}

function onItemPick(item) {
  const choice = itemPicker.choice
  if (!choice) return
  itemNames[item.id] = item.name
  if (!isSelected(choice, item.id) && selected(choice).length < choice.count) {
    selections[choice.key] = [...selected(choice), item.id]
  }
  itemPicker.choice = null
}

function confirm() {
  if (!complete.value) return
  emit('confirm', Object.fromEntries(choices.value.map((choice) => [choice.key, [...selected(choice)]])))
}
</script>

<style scoped>
.fcm { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.fcm-intro { margin: 0 0 2px; color: var(--text-muted); font-size: 12px; line-height: 1.5; }
.fcm-sections { display: flex; flex-direction: column; gap: 10px; max-height: min(60vh, 560px); overflow-y: auto; padding-right: 3px; }
.fcm-section { padding: 13px; border: 1px solid var(--border); border-radius: var(--r-md); background: color-mix(in srgb, var(--surface) 86%, transparent); }
.fcm-section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.fcm-label { color: var(--text-1); font-size: 13px; font-weight: 700; }
.fcm-key { margin-top: 2px; color: var(--text-muted); font-family: monospace; font-size: 9px; }
.fcm-count { flex-shrink: 0; padding: 3px 8px; border-radius: var(--r-pill); background: var(--surface-raised); color: var(--text-muted); font-size: 10px; font-weight: 800; }
.fcm-count.complete { background: color-mix(in srgb, var(--success) 16%, transparent); color: var(--success); }
.fcm-options { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 7px; }
.fcm-option { display: flex; align-items: flex-start; gap: 9px; padding: 9px 10px; border: 1px solid transparent; border-radius: 9px; background: var(--surface-raised); color: var(--text-2); text-align: left; cursor: pointer; }
.fcm-option:hover:not(.disabled) { border-color: color-mix(in srgb, var(--accent) 35%, transparent); }
.fcm-option.selected { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, var(--surface)); }
.fcm-option.disabled { opacity: 0.42; cursor: default; }
.fcm-option-mark { display: grid; place-items: center; width: 17px; height: 17px; flex-shrink: 0; margin-top: 1px; border: 1px solid var(--border-strong); border-radius: 50%; }
.fcm-option.selected .fcm-option-mark { border-color: var(--accent); background: var(--accent); color: var(--text-on-accent); }
.fcm-option-mark svg { width: 11px; height: 11px; }
.fcm-option-copy { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.fcm-option-copy b { color: var(--text-1); font-size: 12px; }
.fcm-option-copy small { color: var(--text-muted); font-size: 10px; line-height: 1.4; }
.fcm-picked-items { display: flex; flex-wrap: wrap; gap: 7px; }
.fcm-picked, .fcm-open-picker { border: none; border-radius: var(--r-pill); font: inherit; font-size: 11px; cursor: pointer; }
.fcm-picked { display: inline-flex; gap: 7px; padding: 6px 9px 6px 12px; background: color-mix(in srgb, var(--accent) 15%, var(--surface)); color: var(--text-1); }
.fcm-picked b { color: var(--text-muted); }
.fcm-open-picker { padding: 6px 12px; background: var(--surface-raised); color: var(--accent); }
.fcm-actions { display: flex; justify-content: flex-end; gap: 9px; padding-top: 2px; }
.fcm-cancel, .fcm-confirm { border: none; border-radius: 9px; padding: 9px 18px; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
.fcm-cancel { background: var(--surface-raised); color: var(--text-2); }
.fcm-confirm { background: var(--accent); color: var(--text-on-accent); }
.fcm-confirm:disabled { opacity: 0.38; cursor: default; }
@media (max-width: 640px) { .fcm-options { grid-template-columns: 1fr; } }
</style>
