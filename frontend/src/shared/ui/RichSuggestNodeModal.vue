<template>
  <AppModalFrame title="Ссылка на справочник" :z-index="4600" @close="$emit('close')">
    <div class="rsm-form">
      <FormField label="Раздел" vertical>
        <FormSelect v-model:value="typeId" @change="picked = null">
          <option value="" disabled>Выберите раздел</option>
          <option v-for="type in types" :key="type.id" :value="String(type.id)">{{ type.name }}</option>
        </FormSelect>
      </FormField>
      <FormField label="Значение" vertical>
        <SuggestPicker
          v-if="typeId"
          :key="typeId"
          :model-value="picked?.id || currentId"
          :suggest-type-id="Number(typeId)"
          value-key="id"
          placeholder="Найти значение…"
          @pick="picked = $event"
        />
        <span v-else class="rsm-hint">Сначала выберите раздел справочника</span>
      </FormField>
      <div v-if="picked || currentSuggest" class="rsm-preview">
        <strong>{{ (picked || currentSuggest).value }}</strong>
        <DndRichContent v-if="(picked || currentSuggest).desc" :html="(picked || currentSuggest).desc" />
        <span v-else>Описание не добавлено</span>
      </div>
    </div>

    <template #footer>
      <div class="rsm-actions">
        <button v-if="editing" type="button" class="rsm-remove" @click="$emit('remove')">Удалить из текста</button>
        <button type="button" class="rsm-cancel" @click="$emit('close')">Отмена</button>
        <button type="button" class="rsm-save" :disabled="!picked && !currentSuggest" @click="save">{{ editing ? 'Сохранить' : 'Вставить' }}</button>
      </div>
    </template>
  </AppModalFrame>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { AppModalFrame, FormField, FormSelect } from '@sylvieshare/share-ui'
import { suggestApi } from '@/shared/api/suggestApi'
import { useSuggestStore } from '@/stores/suggest'
import DndRichContent from '@/shared/ui/DndRichContent.vue'
import SuggestPicker from '@/shared/ui/SuggestPicker.vue'

const props = defineProps({ node: { type: Object, default: null } })
const emit = defineEmits(['close', 'save', 'remove'])
const types = ref([])
const typeId = ref(props.node?.payload?.typeId != null ? String(props.node.payload.typeId) : '')
const currentId = ref(props.node?.payload?.id ?? '')
const picked = ref(null)
const suggestStore = useSuggestStore()
const editing = computed(() => Boolean(props.node))
const currentSuggest = computed(() => suggestStore.items(Number(typeId.value))
  .find(item => Number(item.id) === Number(currentId.value)) || null)

watch(typeId, async value => {
  if (!value) return
  await suggestStore.ensure(Number(value)).catch(() => {})
})

async function load() {
  const response = await suggestApi.types().catch(() => ({ types: [] }))
  types.value = response?.types || []
  if (typeId.value && currentId.value !== '') {
    await suggestStore.ensureItems(Number(typeId.value), [Number(currentId.value)]).catch(() => {})
  }
}

function save() {
  const value = picked.value || currentSuggest.value
  if (!value) return
  emit('save', {
    kind: 'suggest',
    payload: { id: Number(value.id), typeId: Number(value.typeId || typeId.value) },
    label: value.value,
  })
}

onMounted(load)
</script>

<style scoped>
.rsm-form { display: flex; flex-direction: column; gap: 14px; }
.rsm-hint { color: var(--text-muted); font-size: 12px; }
.rsm-preview { display: flex; flex-direction: column; gap: 5px; max-height: 180px; padding: 10px 12px; overflow: auto; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface-raised); color: var(--text-muted); font-size: 12px; }
.rsm-preview strong { color: var(--text-1); font-size: 13px; }
.rsm-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; width: 100%; }
.rsm-actions button { padding: 7px 12px; border: 0; border-radius: var(--r-sm); font: inherit; font-size: 12px; cursor: pointer; }
.rsm-remove { margin-right: auto; background: transparent; color: var(--danger); }
.rsm-cancel { background: transparent; color: var(--text-2); }
.rsm-save { background: var(--accent); color: var(--text-on-accent); font-weight: 700; }
.rsm-save:disabled { cursor: default; opacity: .45; }
</style>
