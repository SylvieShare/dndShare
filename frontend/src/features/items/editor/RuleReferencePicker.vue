<template>
  <button type="button" class="ability-link" :aria-label="label" @click="begin">
    {{ selected?.title || value || (ownerId ? `Ресурс предмета #${ownerId}` : 'Выбрать…') }}
    <small v-if="selected" class="rule-reference-origin">{{ selected.itemName }} · {{ selected.block }}</small>
  </button>
  <AppModalFrame v-if="open" :title="label" :z-index="(editor.zIndex || 4500) + 200" @close="open = false">
    <FormTextInput v-model:value="search" placeholder="Название, источник или ключ…" aria-label="Поиск связи" />
    <div class="rule-reference-results" :aria-busy="loading">
      <BaseTile v-for="entry in results" :key="identity(entry)" interactive>
        <button type="button" class="rule-reference-option" @click="pick(entry)">
          <strong>{{ entry.title }}</strong>
          <span>{{ entry.itemName }} · {{ entry.block }}</span>
          <code v-if="entry.key">{{ entry.key }}</code>
        </button>
      </BaseTile>
      <p v-if="loading" role="status">Загрузка…</p>
      <p v-else-if="error" role="alert">{{ error }} <AddButton label="Повторить" @click="load()" /></p>
      <p v-else-if="!results.length">Подходящих связей нет. Сначала создайте нужный ресурс или эффект.</p>
      <AddButton v-else-if="hasMore" label="Показать ещё" @click="load(true)" />
    </div>
  </AppModalFrame>
</template>
<script setup>
import { computed, inject, onScopeDispose, ref, watch } from 'vue'
import { AddButton, AppModalFrame, BaseTile, FormTextInput } from '@sylvieshare/share-ui'
import { fetchGet } from '@/shared/api/http'
import { itemFieldEditorKey } from '@/features/character-editor/components/useItemFieldEditor'
import { localRuleReferences } from './actionEditorModel'
const props = defineProps({ kind: { type: String, required: true }, value: { default: '' }, ownerId: { default: null }, valueId: { default: '' }, onlyCurrent: Boolean, scopeItemId: { default: 0 }, label: { type: String, default: 'Выбрать связь' } })
const emit = defineEmits(['pick'])
const editor = inject(itemFieldEditorKey, {})
const open = ref(false), search = ref(''), rows = ref([]), known = ref([]), loading = ref(false), error = ref(''), hasMore = ref(false)
let timer, request = 0
const identity = entry => `${entry.kind}:${entry.itemId}:${entry.valueId || ''}:${entry.key}`
const local = computed(() => [...localRuleReferences(editor.itemData || {}, editor.itemId, editor.itemName), { kind: 'counter', key: 'level', valueId: 'exhaustion', title: 'Уровень истощения', block: 'Истощение', itemName: 'Лист персонажа', itemId: 0 }].filter(entry => entry.kind === props.kind && (!props.scopeItemId || Number(props.scopeItemId) === Number(editor.itemId))))
const selected = computed(() => (!props.value && props.ownerId == null) ? null : [...local.value, ...known.value].find(entry => entry.key === (props.value || '') && (!props.valueId || entry.valueId === props.valueId) && (props.ownerId == null || Number(entry.itemId) === Number(props.ownerId))))
const results = computed(() => {
  const query = search.value.trim().toLocaleLowerCase('ru')
  const entries = [...local.value.filter(entry => `${entry.title} ${entry.itemName} ${entry.key}`.toLocaleLowerCase('ru').includes(query)), ...rows.value]
  return [...new Map(entries.map(entry => [identity(entry), entry])).values()]
})
async function load(more = false, query = search.value, resolving = false) {
  if (props.onlyCurrent && !props.scopeItemId) { rows.value = []; loading.value = false; hasMore.value = false; return }
  const version = ++request, offset = more ? rows.value.length : 0
  if (!more) rows.value = []
  loading.value = true; error.value = ''
  try {
    const response = await fetchGet(`/items/rule-references?kind=${encodeURIComponent(props.kind)}&q=${encodeURIComponent(query)}&excludeItemId=${editor.itemId || 0}&itemId=${(resolving ? props.ownerId : null) || props.scopeItemId || 0}&limit=40&offset=${offset}`)
    if (version !== request) return
    const page = response?.references || []
    rows.value = more ? [...rows.value, ...page] : page
    known.value = [...new Map([...known.value, ...page].map(entry => [identity(entry), entry])).values()]
    hasMore.value = page.length === 40
  } catch { if (version === request) error.value = 'Не удалось загрузить связи.' }
  finally { if (version === request) loading.value = false }
}
function begin() { clearTimeout(timer); search.value = ''; open.value = true; load() }
function pick(entry) { emit('pick', entry); open.value = false }
watch(search, () => { clearTimeout(timer); if (!open.value) return; request++; rows.value = []; loading.value = true; timer = setTimeout(() => load(), 200) }, { flush: 'sync' })
watch(() => [props.kind, props.value, props.ownerId, props.valueId], () => { if ((props.value || props.ownerId) && !selected.value) load(false, props.value || '', true) }, { immediate: true })
onScopeDispose(() => { request++; clearTimeout(timer) })
</script>
<style scoped>
.rule-reference-origin { display: block; margin-top: 3px; color: var(--text-muted); font: 11px var(--font-ui); }
.rule-reference-results { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
.rule-reference-option { display: flex; flex-direction: column; gap: 4px; width: 100%; padding: 12px; border: 0; border-radius: inherit; background: none; color: inherit; text-align: left; cursor: pointer; }
.rule-reference-option span, .rule-reference-option code { font-size: 11px; color: var(--text-muted); }
</style>
