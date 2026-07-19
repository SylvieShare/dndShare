<template>
  <div class="step">
    <div class="sheet-section-title">Раса</div>
    <p v-if="loading && !races.length" class="hint">Загрузка справочника…</p>
    <p v-else-if="!races.length" class="hint">В справочнике пока нет рас.</p>
    <div v-else class="grid">
      <SelectTile
        v-for="r in races"
        :key="r.id"
        :title="r.name"
        :subtitle="asiSummary(r)"
        :monogram="monogramOf(r.name)"
        :selected="state.race?.id === r.id"
        @select="state.race = r"
      />
    </div>

    <RichContent v-if="raceDesc" class="step-desc" :html="raceDesc" />

    <template v-if="subraces.length">
      <div class="sheet-section-title step-gap">Происхождение</div>
      <div class="grid">
        <SelectTile
          v-for="s in subraces"
          :key="s.id"
          :title="s.name"
          :subtitle="asiSummary(s)"
          :monogram="monogramOf(s.name)"
          :selected="state.subrace?.id === s.id"
          @select="state.subrace = s"
        />
      </div>
      <RichContent v-if="subraceDesc" class="step-desc" :html="subraceDesc" />
    </template>

    <template v-if="state.race && hasRaceChoices">
      <div class="sheet-section-title step-gap">Выборы расы</div>

      <div v-if="grants.raceVariants" class="opts">
        <div
          v-for="v in grants.raceVariants"
          :key="v.value"
          class="opt"
          :class="{ on: state.raceVariant === v.value }"
          @click="state.raceVariant = v.value"
        >
          <span class="box radio"><svg v-if="state.raceVariant === v.value" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 6" /></svg></span>
          <div class="opt-body">
            <div class="opt-label">{{ v.label }}</div>
            <div v-if="v.desc" class="opt-desc">{{ v.desc }}</div>
          </div>
        </div>
      </div>

      <div v-if="grants.asiChoice" class="asi">
        <p class="hint">
          Прибавь +{{ grants.asiChoice.bonus }} к {{ grants.asiChoice.count }} характеристикам на выбор
          <span class="count" :class="{ done: state.asiChoice.length === grants.asiChoice.count }">{{ state.asiChoice.length }} / {{ grants.asiChoice.count }}</span>
        </p>
        <div class="asi-chips">
          <button
            v-for="s in STATS"
            :key="s"
            class="asi-chip"
            :class="{ on: state.asiChoice.includes(s), off: !state.asiChoice.includes(s) && atAsiLimit }"
            @click="toggleAsiChoice(s)"
          >
            {{ STAT_SHORT[s] }} <b>+{{ grants.asiChoice.bonus }}</b>
          </button>
        </div>
      </div>

      <div v-if="grants.raceSkillChoice" class="pick">
        <p class="hint">
          Владение навыками на выбор
          <span class="count" :class="{ done: raceSkillsComplete }">{{ state.raceSkillIds.length }} / {{ raceSkillLimit }}</span>
        </p>
        <div class="asi-chips">
          <button
            v-for="o in raceSkillOptions"
            :key="o.id"
            class="asi-chip"
            :class="{ on: state.raceSkillIds.includes(o.id), off: !state.raceSkillIds.includes(o.id) && raceSkillsComplete }"
            @click="toggleRaceSkill(o.id)"
          >{{ o.name }}</button>
        </div>
      </div>

      <div v-if="grants.langChoice" class="pick">
        <p class="hint">
          Дополнительный язык на выбор
          <span class="count" :class="{ done: raceLangsComplete }">{{ state.raceLangIds.length }} / {{ raceLangLimit }}</span>
        </p>
        <div class="asi-chips">
          <button
            v-for="o in raceLangOptions"
            :key="o.id"
            class="asi-chip"
            :class="{ on: state.raceLangIds.includes(o.id), off: !state.raceLangIds.includes(o.id) && raceLangsComplete }"
            @click="toggleRaceLang(o.id)"
          >{{ o.name }}</button>
        </div>
      </div>

      <div v-if="grants.featChoice" class="pick">
        <p class="hint">
          Черта на выбор
          <span class="count" :class="{ done: featComplete }">{{ state.featIds.length }} / {{ featLimit }}</span>
        </p>
        <div v-if="state.featIds.length" class="feat-tags">
          <div v-for="id in state.featIds" :key="id" class="feat-tag">
            <span class="feat-tag-name">{{ featName(id) }}</span>
            <button class="feat-x" title="Убрать" @click="toggleFeat(id)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
        </div>
        <button v-if="state.featIds.length < featLimit" class="feat-add" @click="pickerOpen = true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          Выбрать черту
        </button>
      </div>

      <StepChoices v-if="raceFeatureChoices.length" scope="race" />
    </template>

    <ItemPickerModal
      v-if="pickerOpen"
      :item-type-ids="[7]"
      title="Выбор черты"
      search-placeholder="Поиск черты…"
      :exclude-items="state.featIds"
      @pick="onFeatPick"
      @close="pickerOpen = false"
    />
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import ItemPickerModal from '@/features/character-editor/components/ItemPickerModal.vue'
import RichContent from '@/shared/ui/RichContent'
import SelectTile from '@/features/character-list/components/wizard/SelectTile.vue'
import StepChoices from '@/features/character-list/components/wizard/steps/StepChoices.vue'
import { STAT_SHORT, asiSummary, monogramOf } from '@/features/character-list/components/wizard/labels'

const {
  races, subraces, state, loading, grants, STATS, toggleAsiChoice,
  raceSkillOptions, raceSkillLimit, toggleRaceSkill, raceSkillsComplete,
  raceLangOptions, raceLangLimit, toggleRaceLang, raceLangsComplete,
  featPool, featLimit, toggleFeat, featComplete, raceFeatureChoices,
} = inject('createWizard')
const raceDesc = computed(() => state.race?.data?.description || '')
const subraceDesc = computed(() => state.subrace?.data?.description || '')
const atAsiLimit = computed(() => grants.value.asiChoice && state.asiChoice.length >= grants.value.asiChoice.count)
const hasRaceChoices = computed(() => {
  const g = grants.value
  return g.raceVariants || g.asiChoice || g.raceSkillChoice || g.langChoice || g.featChoice || raceFeatureChoices.value.length
})

const pickerOpen = ref(false)
function featName(id) { return featPool.value.find((f) => f.id === id)?.name || `#${id}` }
function onFeatPick(item) { if (item?.id != null) toggleFeat(item.id) }
</script>

<style scoped>
.step { display: flex; flex-direction: column; gap: 12px; }
.step-gap { margin-top: 8px; }
.step-desc {
  font-size: 13px; color: var(--text-2); line-height: 1.5;
  background: var(--block-bg); border-radius: var(--r-md);
  border-left: 3px solid color-mix(in srgb, var(--accent) 55%, transparent);
  padding: 11px 14px;
}
.hint { font-size: 12px; color: var(--text-muted); margin: 0; display: flex; align-items: center; gap: 8px; }
.count { font-size: 12px; font-weight: 600; color: var(--text-muted); }
.count.done { color: var(--success); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }

.opts { display: flex; flex-wrap: wrap; gap: 8px; }
.opt {
  display: flex; align-items: flex-start; gap: 11px; flex: 1 1 220px;
  background: var(--block-bg); border-radius: var(--r-md); padding: 11px 13px; cursor: pointer; transition: background 0.15s;
}
.opt:hover { background: color-mix(in srgb, var(--accent) 12%, var(--block-bg)); }
.opt.on { background: color-mix(in srgb, var(--accent) 16%, var(--block-bg)); }
.opt.off { opacity: 0.45; }
.box { flex-shrink: 0; width: 18px; height: 18px; margin-top: 1px; border-radius: 50%; background: var(--bg); display: flex; align-items: center; justify-content: center; }
.opt.on .box { background: var(--accent); }
.box svg { width: 12px; height: 12px; color: #fff; }
.opt-body { min-width: 0; }
.opt-label { font-size: 14px; color: var(--text-1); font-weight: 500; }
.opt-desc { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

.asi, .pick { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
.asi-chips { display: flex; flex-wrap: wrap; gap: 7px; }
.asi-chip {
  display: inline-flex; align-items: center; gap: 5px;
  background: var(--block-bg); border: none; border-radius: 999px;
  color: var(--text-2); font: inherit; font-size: 12px; padding: 6px 13px; cursor: pointer; transition: background 0.15s;
}
.asi-chip b { color: var(--text-muted); font-variant-numeric: tabular-nums; }
.asi-chip:hover { background: color-mix(in srgb, var(--accent) 14%, var(--block-bg)); }
.asi-chip.on { background: var(--accent); color: #fff; }
.asi-chip.on b { color: #fff; }
.asi-chip.off { opacity: 0.4; cursor: default; }
.asi-chip.off:hover { background: var(--block-bg); }

.feat-tags { display: flex; flex-wrap: wrap; gap: 8px; }
.feat-tag {
  display: inline-flex; align-items: center; gap: 8px;
  background: color-mix(in srgb, var(--accent) 14%, var(--block-bg));
  border-radius: 999px; padding: 6px 8px 6px 14px;
}
.feat-tag-name { font-size: 13px; color: var(--text-1); font-weight: 500; }
.feat-x {
  display: flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border: none; border-radius: 50%;
  background: color-mix(in srgb, #fff 8%, transparent); color: var(--text-2); cursor: pointer;
}
.feat-x:hover { background: var(--danger); color: #fff; }
.feat-x svg { width: 12px; height: 12px; }
.feat-add {
  align-self: flex-start;
  display: inline-flex; align-items: center; gap: 7px;
  background: var(--block-bg); border: none; border-radius: var(--r-md);
  color: var(--accent); font: inherit; font-size: 13px; font-weight: 600;
  padding: 9px 15px; cursor: pointer; transition: background 0.15s;
}
.feat-add:hover { background: color-mix(in srgb, var(--accent) 14%, var(--block-bg)); }
.feat-add svg { width: 16px; height: 16px; }
</style>
