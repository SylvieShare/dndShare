<template>
  <IllustratedChoiceStage
    title="Предыстория"
    :selected="!!state.background"
    :selection-key="state.background?.id"
    :loading="loading && !bgPool.length"
    :empty="!loading && !bgPool.length"
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
          <li v-if="!state.buyStartingEquipment && moneyLabel"><span class="fk">Кошелёк</span>{{ moneyLabel }}</li>
          <li v-if="state.buyStartingEquipment" class="shop-replacement"><span class="fk">Снаряжение</span>Заменено закупкой за начальное богатство класса</li>
        </ul>

        <div v-if="backgroundToolItems.length" class="grant-group">
          <span class="fk">Инструменты</span>
          <div class="grant-tiles">
            <ItemReferenceRow
              v-for="item in backgroundToolItems"
              :key="`${item.item_id}:${JSON.stringify(item.params)}`"
              :item="{ ...item, id: item.item_id }"
              :params="item.params"
              roomy-weapon
              @activate="viewItem = { ...item, id: item.item_id }"
            />
          </div>
        </div>

        <div v-if="!state.buyStartingEquipment && backgroundStart.items.length" class="grant-group">
          <span class="fk">Снаряжение</span>
          <div class="grant-tiles">
            <ItemReferenceRow
              v-for="entry in backgroundStart.items"
              :key="`${entry.item_id}:${JSON.stringify(entry.params)}`"
              :item="{ ...entry, id: entry.item_id }"
              :count="entry.count"
              :params="entry.params"
              roomy-weapon
              @activate="viewItem = { ...entry, id: entry.item_id }"
            />
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
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import BackgroundSelectCard from '@/features/character-list/components/wizard/BackgroundSelectCard.vue'
import IllustratedChoiceStage from '@/features/character-list/components/wizard/IllustratedChoiceStage.vue'
import MultiSearchSelect from '@/features/character-list/components/wizard/MultiSearchSelect.vue'
import ItemReferenceRow from '@/features/items/components/ItemReferenceRow.vue'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
import { monogramOf } from '@/features/character-list/components/wizard/labels'
import { formatStartingCoins } from '@/features/character-editor/settings/dnd/creation/backgroundEquipment'

const {
  bgPool, state, loading, grants, suggestValue,
  backgroundSkillNames, backgroundStart, backgroundToolItems,
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
const moneyLabel = computed(() => formatStartingCoins(backgroundStart.value.coins))
const visibleBackgrounds = computed(() => state.background ? [state.background] : bgPool.value)
const viewItem = ref(null)

function selectBackground(background) {
  if (state.background?.id === background.id) return
  state.background = background
}
</script>

<style scoped>
.hint { font-size: 12px; color: var(--text-muted); margin: 0; display: flex; align-items: center; gap: 8px; }
.count { font-size: 12px; font-weight: 600; color: var(--text-muted); }
.count.done { color: var(--success); }
.background-details { display: flex; flex-direction: column; gap: 12px; padding: 16px; border: 1px solid color-mix(in srgb, var(--border) 82%, transparent); border-radius: calc(var(--r-md) + 2px); background: color-mix(in srgb, var(--surface) 54%, transparent); box-shadow: inset 3px 0 0 color-mix(in srgb, var(--accent) 22%, transparent); }

.facts { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.facts li { font-size: 13px; color: var(--text-2); line-height: 1.4; }
.facts b { color: var(--text-1); font-weight: 600; }
.shop-replacement { padding: 8px 10px; border-radius: var(--r-sm); background: color-mix(in srgb, var(--accent) 9%, transparent); }
.fk { display: block; font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 1px; }
.grant-group { display: flex; flex-direction: column; gap: 6px; }
.grant-tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }

.pick { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
@media (max-width: 640px) { .background-details { padding: 14px; } .grant-tiles { grid-template-columns: 1fr; } }
</style>
