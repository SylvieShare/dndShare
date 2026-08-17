<template>
  <AppModalFrame title="Формула броска" :z-index="4600" @close="$emit('close')">
    <div class="rdm-form">
      <FormField label="Формула" hint="например 2к6 + 3" vertical>
        <FormTextInput ref="formulaInput" v-model:value="formula" mono placeholder="к20 + 4" @enter="save" />
      </FormField>
      <FormField label="Подпись" hint="будет заголовком результата" vertical>
        <FormTextInput v-model:value="label" placeholder="Атака, урон, лечение…" @enter="save" />
      </FormField>
      <div class="rdm-preview" :class="{ 'rdm-preview--invalid': formula && !valid }">
        <template v-if="valid">
          <template v-for="(part, index) in parts" :key="index">
            <span v-if="index">{{ part.sign }}</span>
            <span v-if="part.kind === 'dice'" class="rdm-die"><b v-if="part.n > 1">{{ part.n }}×</b><SystemDie :sides="part.sides" :size="30" /></span>
            <b v-else>{{ part.value }}</b>
          </template>
        </template>
        <span v-else>{{ formula ? 'В формуле должен быть хотя бы один кубик' : 'Введите формулу броска' }}</span>
      </div>
    </div>

    <template #footer>
      <div class="rdm-actions">
        <button v-if="editing" type="button" class="rdm-remove" @click="$emit('remove')">Удалить из текста</button>
        <button type="button" class="rdm-cancel" @click="$emit('close')">Отмена</button>
        <button type="button" class="rdm-save" :disabled="!valid" @click="save">{{ editing ? 'Сохранить' : 'Вставить' }}</button>
      </div>
    </template>
  </AppModalFrame>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { AppModalFrame, FormField, FormTextInput } from '@sylvieshare/share-ui'
import { parseDiceExpression } from '@/shared/lib/dice'
import SystemDie from '@/shared/ui/SystemDie.vue'

const props = defineProps({ node: { type: Object, default: null } })
const emit = defineEmits(['close', 'save', 'remove'])
const formulaInput = ref(null)
const formula = ref(String(props.node?.payload?.formula || ''))
const label = ref(String(props.node?.payload?.label || ''))
const parts = computed(() => parseDiceExpression(formula.value))
const valid = computed(() => parts.value.some(part => part.kind === 'dice'))
const editing = computed(() => Boolean(props.node))

function save() {
  if (!valid.value) return
  const cleanFormula = formula.value.trim()
  const cleanLabel = label.value.trim()
  emit('save', {
    kind: 'dice',
    payload: { formula: cleanFormula, ...(cleanLabel ? { label: cleanLabel } : {}) },
    label: cleanLabel ? `${cleanLabel}: ${cleanFormula}` : cleanFormula,
  })
}

onMounted(() => nextTick(() => formulaInput.value?.focus?.()))
</script>

<style scoped>
.rdm-form { display: flex; flex-direction: column; gap: 14px; }
.rdm-preview { display: flex; align-items: center; gap: 5px; min-height: 48px; padding: 8px 12px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface-raised); color: var(--text-muted); }
.rdm-preview--invalid { border-color: color-mix(in srgb, var(--danger) 45%, var(--border)); color: var(--danger); }
.rdm-die { display: inline-flex; align-items: center; gap: 2px; color: var(--accent-soft); }
.rdm-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; width: 100%; }
.rdm-actions button { padding: 7px 12px; border: 0; border-radius: var(--r-sm); font: inherit; font-size: 12px; cursor: pointer; }
.rdm-remove { margin-right: auto; background: transparent; color: var(--danger); }
.rdm-cancel { background: transparent; color: var(--text-2); }
.rdm-save { background: var(--accent); color: var(--text-on-accent); font-weight: 700; }
.rdm-save:disabled { cursor: default; opacity: .45; }
</style>
