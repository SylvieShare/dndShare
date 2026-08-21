<template>
  <div class="step">
    <IllustratedChoiceStage
      title="Предыстория"
      :selected="!!state.background"
      :selection-key="state.background?.id"
      :loading="loading && !bgPool.length && !state.background"
      :empty="!loading && !bgPool.length && !state.background"
      empty-text="В справочнике пока нет предысторий."
      back-text="К выбору предыстории"
      two-column
      @clear="state.background = null"
    >
    <template #cards>
      <BackgroundSelectCard
        v-for="b in visibleBackgrounds"
        :key="b.id"
        :title="b.name"
        :subtitle="skillsOf(b)"
        :description="descriptionOf(b)"
        :monogram="monogramOf(b.name)"
        :image-url="b.coverImageUrl || ''"
        :selected="state.background?.id === b.id"
        @select="selectBackground(b)"
      />
    </template>

    <template #details>
      <section class="background-details">
        <div class="sheet-section-title">Что даёт предыстория</div>
        <ul class="facts">
          <li v-if="backgroundSkillNames.length"><span class="fk">Навыки</span>{{ backgroundSkillNames.join(', ') }}</li>
          <li v-if="feature.title"><span class="fk">Умение</span><b>{{ feature.title }}</b>{{ feature.desc ? ' — ' + feature.desc : '' }}</li>
          <li v-if="state.buyStartingEquipment" class="shop-replacement"><span class="fk">Снаряжение</span>Заменено закупкой за начальное богатство класса</li>
        </ul>

        <BaseTile
          v-if="!state.buyStartingEquipment && backgroundCoins.length"
          class="background-wallet"
          color="var(--warning)"
          tint
        >
          <BlockMoneyView title="Кошелёк" :loading="currencyLoading" :coins="backgroundCoins" />
        </BaseTile>

        <div v-if="activeBackgroundItemChoices.length" class="grant-group background-choices">
          <div class="background-choices-head">
            <span class="fk">Выбор предыстории</span>
            <span class="count" :class="{ done: backgroundItemChoicesComplete }">
              {{ selectedChoiceCount }} / {{ activeBackgroundItemChoices.length }}
            </span>
          </div>
          <div class="background-choice-list">
            <div v-for="choice in activeBackgroundItemChoices" :key="choice.key" class="background-choice">
              <span class="background-choice-label">
                {{ choice.label }}
                <span class="background-choice-effect">{{ choiceEffectLabel(choice) }}</span>
              </span>
              <EquipmentItemSelect
                :items="choice.options"
                :model-value="state.backgroundItemChoices?.[choice.key] || ''"
                :placeholder="`Выберите: ${choice.label.toLocaleLowerCase('ru')}`"
                @update:model-value="setBackgroundItemChoice(choice.key, $event)"
                @details="viewItem = $event"
              />
            </div>
          </div>
        </div>

        <div v-if="displayedBackgroundToolItems.length" class="grant-group">
          <span class="fk">Владения инструментами</span>
          <div class="grant-tiles">
            <ItemReferenceRow
              v-for="item in displayedBackgroundToolItems"
              :key="`${item.item_id}:${JSON.stringify(item.params)}`"
              :item="{ ...item, id: item.item_id }"
              :params="item.params"
              roomy-weapon
              @activate="viewItem = { ...item, id: item.item_id }"
            />
          </div>
        </div>

        <div v-if="!state.buyStartingEquipment && displayedBackgroundEquipment.length" class="grant-group">
          <span class="fk">Снаряжение</span>
          <div v-if="backgroundWeaponItems.length" class="grant-subgroup">
            <span class="grant-subtitle">Оружие</span>
            <div class="grant-tiles grant-tiles--weapons">
              <ItemReferenceRow
                v-for="entry in backgroundWeaponItems"
                :key="`${entry.item_id}:${JSON.stringify(entry.params)}`"
                :item="{ ...entry, id: entry.item_id }"
                :count="entry.count"
                :params="entry.params"
                roomy-weapon
                @activate="viewItem = { ...entry, id: entry.item_id }"
              />
            </div>
          </div>
          <div v-if="backgroundOtherItems.length" class="grant-subgroup">
            <span v-if="backgroundWeaponItems.length" class="grant-subtitle">Остальное снаряжение</span>
            <div class="grant-tiles grant-tiles--equipment">
              <ItemReferenceRow
                v-for="entry in backgroundOtherItems"
                :key="`${entry.item_id}:${JSON.stringify(entry.params)}`"
                :item="{ ...entry, id: entry.item_id }"
                :count="entry.count"
                :params="entry.params"
                @activate="viewItem = { ...entry, id: entry.item_id }"
              />
            </div>
          </div>
        </div>

        <div v-if="grants.bgLangChoice" class="pick">
          <p class="hint">
            Дополнительные языки на выбор
            <span class="count" :class="{ done: bgLangsComplete }">{{ state.bgLangIds.length }} / {{ bgLangLimit }}</span>
          </p>
          <MultiSearchSelect
            :options="bgLangOptions"
            :selected="state.bgLangIds"
            :limit="bgLangLimit"
            :suggest-type-id="6"
            allow-create
            placeholder="Найти язык…"
            @toggle="toggleBgLang"
          />
        </div>
      </section>
    </template>
    </IllustratedChoiceStage>
    <ItemViewModal
      v-if="viewItem"
      :item-id="viewItem.id"
      :item-type-id="viewItem.typeId"
      @close="viewItem = null"
    />
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { BaseTile } from '@sylvieshare/share-ui'
import BackgroundSelectCard from '@/features/character-list/components/wizard/BackgroundSelectCard.vue'
import EquipmentItemSelect from '@/features/character-list/components/wizard/EquipmentItemSelect.vue'
import IllustratedChoiceStage from '@/features/character-list/components/wizard/IllustratedChoiceStage.vue'
import MultiSearchSelect from '@/features/character-list/components/wizard/MultiSearchSelect.vue'
import BlockMoneyView from '@/features/character-editor/blocks/generic/components/BlockMoneyView.vue'
import ItemReferenceRow from '@/features/items/components/ItemReferenceRow.vue'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
import { monogramOf } from '@/features/character-list/components/wizard/labels'
import { COIN_ORDER } from '@/features/character-editor/settings/dnd/creation/backgroundEquipment'
import { useSuggestStore } from '@/stores/suggest'

const {
  bgPool, state, loading, grants, suggestValue,
  backgroundSkillNames, backgroundStart, backgroundToolItems,
  activeBackgroundItemChoices, backgroundItemChoicesComplete, setBackgroundItemChoice,
  bgLangOptions, bgLangLimit, toggleBgLang, bgLangsComplete,
} = inject('createWizard')

function skillsOf(b) {
  return (b.data?.skills || []).map((id) => suggestValue(15, id)).filter(Boolean).join(', ')
}
function descriptionOf(b) {
  return String(b.data?.description || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}
const feature = computed(() => {
  const d = state.background?.data || {}
  const desc = d.feature_desc ? String(d.feature_desc).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : ''
  return { title: d.feature || '', desc }
})
const suggestStore = useSuggestStore()
const currencyLoading = ref(!suggestStore.loaded(17))
const fallbackCoinLabels = { 1: 'мм', 2: 'см', 3: 'зм', 4: 'эм', 5: 'пм' }
const backgroundCoins = computed(() => {
  const currencies = new Map(suggestStore.items(17).map((coin) => [String(coin.id), coin]))
  return [...COIN_ORDER].reverse()
    .filter((id) => Number(backgroundStart.value.coins[id]) > 0)
    .map((id) => {
      const currency = currencies.get(String(id))
      return {
        id,
        title: currency?.value || fallbackCoinLabels[id] || `мон. ${id}`,
        iconUrl: currency?.svg || '',
        color: currency?.color || '#d6a84f',
        amount: Number(backgroundStart.value.coins[id]),
      }
    })
})
function selectedChoiceIds(effectKey) {
  return new Set(activeBackgroundItemChoices.value.flatMap((choice) => {
    if (choice?.[effectKey] !== true) return []
    const selected = choice.options.find(item => String(item.id) === String(state.backgroundItemChoices?.[choice.key]))
    return selected ? [String(selected.id)] : []
  }))
}
const displayedBackgroundToolItems = computed(() => {
  const selected = selectedChoiceIds('grants_tool_item')
  return backgroundToolItems.value.filter(entry => !selected.has(String(entry.item_id)))
})
const displayedBackgroundEquipment = computed(() => {
  const selected = selectedChoiceIds('grants_equipment_item')
  return backgroundStart.value.items.filter(entry => !selected.has(String(entry.item_id)))
})
const backgroundWeaponItems = computed(() => displayedBackgroundEquipment.value.filter((entry) => Number(entry.typeId) === 1))
const backgroundOtherItems = computed(() => displayedBackgroundEquipment.value.filter((entry) => Number(entry.typeId) !== 1))
const selectedChoiceCount = computed(() => activeBackgroundItemChoices.value.filter((choice) => (
  choice.options.some((item) => String(item.id) === String(state.backgroundItemChoices?.[choice.key]))
)).length)
const visibleBackgrounds = computed(() => state.background ? [state.background] : bgPool.value)
const viewItem = ref(null)

function choiceEffectLabel(choice) {
  const proficiency = choice.grants_tool_proficiency === true
  const physicalItem = choice.grants_equipment_item === true
  if (proficiency && physicalItem) return 'Владение + предмет'
  if (proficiency) return 'Владение'
  return 'Предмет'
}

suggestStore.ensure(17).catch(() => {}).finally(() => { currencyLoading.value = false })

function selectBackground(background) {
  if (state.background?.id === background.id) return
  state.background = background
}
</script>

<style scoped>
.step { position: relative; display: flex; flex-direction: column; gap: 12px; }
.hint { font-size: 12px; color: var(--text-muted); margin: 0; display: flex; align-items: center; gap: 8px; }
.count { font-size: 12px; font-weight: 600; color: var(--text-muted); }
.count.done { color: var(--success); }
.background-details { display: flex; flex-direction: column; gap: 12px; padding: 16px; border: 1px solid color-mix(in srgb, var(--border) 82%, transparent); border-radius: calc(var(--r-md) + 2px); background: color-mix(in srgb, var(--surface) 54%, transparent); box-shadow: inset 3px 0 0 color-mix(in srgb, var(--accent) 22%, transparent); }

.facts { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.facts li { font-size: 13px; color: var(--text-2); line-height: 1.4; }
.facts b { color: var(--text-1); font-weight: 600; }
.shop-replacement { padding: 8px 10px; border-radius: var(--r-sm); background: color-mix(in srgb, var(--accent) 9%, transparent); }
.fk { display: block; font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 1px; }
.background-wallet { padding: 15px 16px; }
.background-wallet :deep(.money-title) { margin-bottom: 10px; color: var(--warning); font-size: 11px; letter-spacing: .06em; text-transform: uppercase; }
.background-wallet :deep(.money-line) { align-items: center; gap: 10px 22px; }
.background-wallet :deep(.money-amount) { align-items: center; gap: 9px; }
.background-wallet :deep(.ma-value) { font-size: 28px; font-weight: 800; }
.background-wallet :deep(.ma-img) { width: 24px; height: 24px; color: var(--warning); }
.background-wallet :deep(.ma-img svg) { width: 24px; height: 24px; }
.background-wallet :deep(.ma-dot) { width: 20px; height: 20px; }
.background-wallet :deep(.ma-label) { font-size: 14px; font-weight: 650; }
.grant-group { display: flex; flex-direction: column; gap: 6px; }
.background-choices { padding: 12px; border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border)); border-radius: var(--r-md); background: color-mix(in srgb, var(--accent) 6%, transparent); }
.background-choices-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.background-choices-head .fk { margin: 0; }
.background-choice-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.background-choice { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.background-choice-label { color: var(--text-2); font-size: 11px; font-weight: 650; }
.background-choice-effect { display: inline-flex; margin-left: 5px; padding: 2px 6px; border-radius: var(--r-pill); background: color-mix(in srgb, var(--accent) 13%, transparent); color: var(--accent-soft); font-size: 9px; font-weight: 750; letter-spacing: .02em; }
.grant-subgroup { display: flex; flex-direction: column; gap: 5px; }
.grant-subgroup + .grant-subgroup { margin-top: 3px; }
.grant-subtitle { color: var(--text-muted); font-size: 10px; font-weight: 650; line-height: 1.2; }
.grant-tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; gap: 8px; }

.pick { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
@media (max-width: 640px) { .background-details { padding: 14px; } .grant-tiles, .background-choice-list { grid-template-columns: 1fr; } }
</style>
