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
        :selected="state.background?.id === b.id"
        @select="state.background = b"
      />
    </div>

    <template v-if="state.background">
      <div class="sheet-section-title step-gap">Что даёт предыстория</div>
      <ul class="facts">
        <li v-if="backgroundSkillNames.length"><span class="fk">Навыки</span>{{ backgroundSkillNames.join(', ') }}</li>
        <li v-if="backgroundToolNames.length"><span class="fk">Инструменты</span>{{ backgroundToolNames.join(', ') }}</li>
        <li v-if="feature.title"><span class="fk">Черта</span><b>{{ feature.title }}</b>{{ feature.desc ? ' — ' + feature.desc : '' }}</li>
        <li v-if="equipmentText"><span class="fk">Снаряжение</span>{{ equipmentText }}</li>
      </ul>

      <div v-if="grants.bgLangChoice" class="pick">
        <p class="hint">
          Дополнительные языки на выбор
          <span class="count" :class="{ done: bgLangsComplete }">{{ state.bgLangIds.length }} / {{ bgLangLimit }}</span>
        </p>
        <div class="chips">
          <button
            v-for="o in bgLangOptions"
            :key="o.id"
            class="chip"
            :class="{ on: state.bgLangIds.includes(o.id), off: !state.bgLangIds.includes(o.id) && bgLangsComplete }"
            @click="toggleBgLang(o.id)"
          >{{ o.name }}</button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import SelectTile from '@/features/character-list/components/wizard/SelectTile.vue'
import { monogramOf } from '@/features/character-list/components/wizard/labels'

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
const equipmentText = computed(() => {
  const raw = state.background?.data?.equipment || ''
  return raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
})
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
.chips { display: flex; flex-wrap: wrap; gap: 7px; }
.chip {
  background: var(--block-bg); border: none; border-radius: 999px;
  color: var(--text-2); font: inherit; font-size: 12px; padding: 6px 13px; cursor: pointer; transition: background 0.15s;
}
.chip:hover { background: color-mix(in srgb, var(--accent) 14%, var(--block-bg)); }
.chip.on { background: var(--accent); color: #fff; }
.chip.off { opacity: 0.4; cursor: default; }
.chip.off:hover { background: var(--block-bg); }
</style>
