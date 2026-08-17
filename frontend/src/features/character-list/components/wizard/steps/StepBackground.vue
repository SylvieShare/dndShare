<template>
  <div class="step">
    <div class="sheet-section-title">Предыстория</div>
    <p v-if="loading && !bgPool.length" class="hint">Загрузка справочника…</p>
    <p v-else-if="!bgPool.length" class="hint">В справочнике пока нет предысторий.</p>
    <div v-else class="grid">
      <SelectTile
        v-for="b in bgPool"
        :key="b.id"
        :title="b.name"
        :subtitle="skillsOf(b)"
        :monogram="monogramOf(b.name)"
        :image-url="b.iconImageUrl || ''"
        :svg="b.svg || ''"
        :selected="state.background?.id === b.id"
        @select="state.background = b"
      />
    </div>

    <template v-if="state.background">
      <div class="sheet-section-title step-gap">Что даёт предыстория</div>
      <ul class="facts">
        <li v-if="backgroundSkillNames.length"><span class="fk">Навыки</span>{{ backgroundSkillNames.join(', ') }}</li>
        <li v-if="backgroundToolNames.length"><span class="fk">Инструменты</span>{{ backgroundToolNames.join(', ') }}</li>
        <li v-if="feature.title"><span class="fk">Умение</span><b>{{ feature.title }}</b>{{ feature.desc ? ' — ' + feature.desc : '' }}</li>
        <li v-if="backgroundStart.items.length"><span class="fk">Снаряжение</span>{{ equipmentLabel }}</li>
        <li v-if="moneyLabel"><span class="fk">Кошелёк</span>{{ moneyLabel }}</li>
      </ul>

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
    </template>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import MultiSearchSelect from '@/features/character-list/components/wizard/MultiSearchSelect.vue'
import SelectTile from '@/features/character-list/components/wizard/SelectTile.vue'
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
const feature = computed(() => {
  const d = state.background?.data || {}
  const desc = d.feature_desc ? String(d.feature_desc).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : ''
  return { title: d.feature || '', desc }
})
const backgroundStart = computed(() => backgroundStartingEquipment(state.background))
const equipmentLabel = computed(() => backgroundStart.value.items.map((entry) => entry.name).join(', '))
const moneyLabel = computed(() => formatStartingCoins(backgroundStart.value.coins))
</script>

<style scoped>
.step { display: flex; flex-direction: column; gap: 12px; }
.step-gap { margin-top: 8px; }
.hint { font-size: 12px; color: var(--text-muted); margin: 0; display: flex; align-items: center; gap: 8px; }
.count { font-size: 12px; font-weight: 600; color: var(--text-muted); }
.count.done { color: var(--success); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }

.facts { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.facts li { font-size: 13px; color: var(--text-2); line-height: 1.4; }
.facts b { color: var(--text-1); font-weight: 600; }
.fk { display: block; font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 1px; }

.pick { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
</style>
