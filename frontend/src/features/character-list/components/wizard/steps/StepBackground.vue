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

        <div v-if="backgroundToolNames.length" class="grant-group">
          <span class="fk">Инструменты</span>
          <div class="grant-tiles">
            <BaseTile
              v-for="toolName in backgroundToolNames"
              :key="toolName"
              class="grant-tile"
              color="var(--accent)"
              tint
            >
              <span class="grant-icon grant-icon--tool"><Hammer :size="22" aria-hidden="true" /></span>
              <span class="grant-copy">
                <strong>{{ toolName }}</strong>
                <small>Владение инструментом</small>
              </span>
            </BaseTile>
          </div>
        </div>

        <div v-if="!state.buyStartingEquipment && backgroundStart.items.length" class="grant-group">
          <span class="fk">Снаряжение</span>
          <div class="grant-tiles">
            <BaseTile
              v-for="(entry, entryIndex) in backgroundStart.items"
              :key="`${entry.name}-${entryIndex}`"
              class="grant-tile"
              color="var(--info)"
              tint
            >
              <span class="grant-icon grant-icon--equipment"><Backpack :size="22" aria-hidden="true" /></span>
              <span class="grant-copy">
                <strong>{{ entry.name }}</strong>
                <small>Стартовое снаряжение</small>
              </span>
              <span v-if="entry.count > 1" class="grant-count">×{{ entry.count }}</span>
            </BaseTile>
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
</template>

<script setup>
import { computed, inject } from 'vue'
import { Backpack, Hammer } from '@lucide/vue'
import { BaseTile } from '@sylvieshare/share-ui'
import BackgroundSelectCard from '@/features/character-list/components/wizard/BackgroundSelectCard.vue'
import IllustratedChoiceStage from '@/features/character-list/components/wizard/IllustratedChoiceStage.vue'
import MultiSearchSelect from '@/features/character-list/components/wizard/MultiSearchSelect.vue'
import { monogramOf } from '@/features/character-list/components/wizard/labels'
import { backgroundStartingEquipment, formatStartingCoins } from '@/features/character-editor/settings/dnd/creation/backgroundEquipment'

const {
  bgPool, state, loading, grants, suggestValue,
  backgroundSkillNames, backgroundToolNames,
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
const backgroundStart = computed(() => backgroundStartingEquipment(state.background))
const moneyLabel = computed(() => formatStartingCoins(backgroundStart.value.coins))
const visibleBackgrounds = computed(() => state.background ? [state.background] : bgPool.value)

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
.grant-tile { min-width: 0; min-height: 58px; display: flex; align-items: center; gap: 10px; padding: 10px 12px; }
.grant-icon { width: 34px; height: 34px; flex: none; display: grid; place-items: center; border-radius: var(--r-md); }
.grant-icon--tool { background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--accent-soft); }
.grant-icon--equipment { background: color-mix(in srgb, var(--info) 14%, transparent); color: var(--info); }
.grant-copy { min-width: 0; display: flex; flex: 1; flex-direction: column; gap: 2px; }
.grant-copy strong { overflow: hidden; color: var(--text-1); font-size: 12px; font-weight: 650; line-height: 1.3; text-overflow: ellipsis; }
.grant-copy small { color: var(--text-muted); font-size: 9px; line-height: 1.2; }
.grant-count { flex: none; color: var(--accent-soft); font-size: 12px; font-weight: 800; }

.pick { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
@media (max-width: 640px) { .background-details { padding: 14px; } .grant-tiles { grid-template-columns: 1fr; } }
</style>
