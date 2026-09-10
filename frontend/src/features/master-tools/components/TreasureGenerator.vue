<template>
  <div class="tools-columns">
    <BaseTile class="tools-settings">
      <h2>Состав находки</h2>
      <p class="tools-muted">Предметы выбираются из справочников по отметке участия, уровню и весу выпадения.</p>
      <div class="tools-fields">
        <FormField label="Уровень группы" vertical title="Фильтрует авторский диапазон уровней у предмета."><FormTextInput v-model:value="options.level" type="number" min="1" max="20" /></FormField>
        <FormField label="Предметов" vertical title="До 20 разных записей. Если подходящих меньше, генератор покажет доступные."><FormTextInput v-model:value="options.count" type="number" min="0" max="20" /></FormField>
        <FormField label="Состав" vertical><FormSelect v-model:value="options.pool" @update:value="options.typeId = ''"><option value="magic">Магические предметы и зелья</option><option value="mundane">Обычное снаряжение</option><option value="all">Все предметы</option></FormSelect></FormField>
        <FormField label="Максимальная редкость" vertical><FormSelect v-model:value="options.maxRarity"><option v-for="(name, i) in RARITIES" :key="i" :value="i">{{ name }}</option></FormSelect></FormField>
        <FormField label="Справочник" vertical><FormSelect v-model:value="options.typeId"><option value="">Все подходящие</option><option v-for="type in visibleTypes" :key="type.id" :value="type.id">{{ type.name }}</option></FormSelect></FormField>
        <FormField label="Только общие предметы" title="Выключите, чтобы включить ваши личные записи с отметкой участия."><ToggleSwitch v-model="options.publicOnly" aria-label="Только общие предметы" /></FormField>
        <FormField label="Монеты от, зм" vertical><FormTextInput v-model:value="options.goldMin" type="number" min="0" max="1000000" /></FormField>
        <FormField label="Монеты до, зм" vertical><FormTextInput v-model:value="options.goldMax" type="number" min="0" max="1000000" /></FormField>
      </div>
      <p class="tools-muted">Монеты бросаются отдельно от предметов. Это настраиваемый подбор, не таблицы сокровищ из книги мастера.</p>
      <p v-if="error" role="alert">{{ error }} <ActionButton variant="secondary" @click="load">Повторить загрузку</ActionButton></p>
      <p v-else-if="validation" role="alert">{{ validation }}</p>
      <p v-else class="tools-muted">{{ candidates.length }} подходящих предметов</p>
      <ActionButton :disabled="loading || !!error || !!validation || (!candidates.length && Number(options.count) > 0)" @click="generate"><template #icon><Dices :size="18" /></template> {{ result ? 'Сгенерировать ещё' : 'Сгенерировать сокровища' }}</ActionButton>
    </BaseTile>
    <div class="tools-result" aria-live="polite">
      <LoadingState v-if="loading" label="Собираем предметы…" />
      <BaseTile v-else-if="!result" class="tools-empty"><Gem :size="40" /><h2>Здесь появятся сокровища</h2><p>{{ candidates.length ? 'Выберите состав находки и бросьте кости.' : 'Нет подходящих предметов. Измените фильтры или включите участие в редакторе предмета.' }}</p></BaseTile>
      <template v-else>
        <div class="tools-result-heading"><div><span class="tools-eyebrow">Находка</span><h2>{{ result.gold.toLocaleString('ru') }} золотых</h2></div><ActionButton variant="secondary" @click="copy"><template #icon><Copy :size="16" /></template> {{ copyLabel }}</ActionButton></div>
        <p v-if="result.missing" class="tools-muted">Не хватило {{ result.missing }} разных предметов. Показаны все доступные по этим условиям.</p>
        <SectionList v-if="result.items.length" title="Предметы">
          <div v-for="item in result.items" :key="item.id" class="treasure-row">
            <button class="treasure-item" :aria-label="`Открыть ${item.name}`" @click="selected = item"><HandbookListItem :item="item" /></button>
            <span v-if="item.data?.weapon && !item.data.weapon.base_item_id" class="tools-muted treasure-note">Оружейную основу можно выбрать в свойствах экземпляра на листе.</span>
          </div>
        </SectionList>
        <p v-else class="tools-muted">В этой находке только монеты.</p>
      </template>
    </div>
    <ItemViewModal v-if="selected" :item="selected" :item-id="selected.id" :item-type-id="selected.typeId" @close="selected = null" />
  </div>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { ActionButton, BaseTile, FormField, FormSelect, FormTextInput, LoadingState, SectionList, ToggleSwitch } from '@sylvieshare/share-ui'
import { Copy, Dices, Gem } from '@lucide/vue'
import { fetchGet } from '@/shared/api/http'
import { useGameContextStore } from '@/stores/gameContext'
import HandbookListItem from '@/features/items/list-components/HandbookListItem.vue'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
import { generateTreasure, RARITIES, treasureCandidates, treasureOptionsError, treasureText } from '../lib/treasureGenerator'
const game = useGameContextStore()
const options = ref({ level: 1, count: 3, pool: 'magic', maxRarity: 1, typeId: '', publicOnly: true, goldMin: 10, goldMax: 50 })
const items = ref([]), loading = ref(false), error = ref(''), result = ref(null), selected = ref(null), copyLabel = ref('Скопировать')
const types = [{ id: 1, name: 'Оружие' }, { id: 2, name: 'Вещи' }, { id: 10, name: 'Зелья' }, { id: 12, name: 'Доспехи' }, { id: 13, name: 'Транспорт' }, { id: 14, name: 'Инструменты' }, { id: 19, name: 'Магические предметы' }]
const visibleTypes = computed(() => types.filter(t => options.value.pool === 'all' || (options.value.pool === 'magic') === [10, 19].includes(t.id)))
const validation = computed(() => treasureOptionsError(options.value))
const candidates = computed(() => treasureCandidates(items.value, options.value))
let request = 0
async function load() {
  const token = ++request
  loading.value = true; error.value = ''; result.value = null
  try {
    const response = await fetchGet(`/master-tools/treasure-pool?sourceVersionId=${game.sourceVersionId}`)
    if (token !== request) return
    if (!Array.isArray(response?.items)) throw new Error('pool')
    items.value = response.items
  } catch { if (token === request) error.value = 'Не удалось загрузить каталог сокровищ.' }
  finally { if (token === request) loading.value = false }
}
watch(() => game.sourceVersionId, load, { immediate: true })
function generate() { result.value = generateTreasure(items.value, options.value); copyLabel.value = 'Скопировать' }
async function copy() { try { await navigator.clipboard.writeText(treasureText(result.value)); copyLabel.value = 'Скопировано' } catch { copyLabel.value = 'Не удалось скопировать' } }
</script>
