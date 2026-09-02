<template>
  <div class="step" :class="{ 'step--compact': compact }">
    <template v-for="fc in list" :key="fc.id">
      <SkillPicker
        v-if="isSkillChoice(fc.choice)"
        :title="fc.name"
        :hint="fc.choice.text || 'Выбери навыки, которыми персонаж будет владеть.'"
        :options="skillOptionsFor(fc)"
        :selected="choiceSelected(fc.id)"
        :limit="Number(fc.choice.count) || 1"
        @toggle="(id) => toggleChoice(fc.id, id, Number(fc.choice.count) || 1)"
      />

      <template v-else>
        <div class="sheet-section-title">
          {{ fc.name }}
          <span class="count" :class="{ done: choiceSelected(fc.id).length === (Number(fc.choice.count) || 1) }">{{ choiceSelected(fc.id).length }} / {{ Number(fc.choice.count) || 1 }}</span>
        </div>
        <p v-if="fc.choice.text" class="hint">{{ fc.choice.text }}</p>

        <MultiSearchSelect
          v-if="isLangChoice(fc.choice)"
          :options="optionsFor(fc)"
          :selected="choiceSelected(fc.id)"
          :limit="Number(fc.choice.count) || 1"
          :suggest-type-id="6"
          allow-create
          placeholder="Найти язык…"
          @toggle="(id) => toggleChoice(fc.id, id, Number(fc.choice.count) || 1)"
        />

        <div v-else-if="isSpellChoice(fc.choice)" class="spell-list">
          <SpellSelectTile
            v-for="opt in choiceOptionList(fc)"
            :key="opt.value"
            :spell="opt.item"
            :school="schoolName(opt.item)"
            :selected="isSel(fc, opt)"
            :disabled="locked(fc, opt)"
            @select="toggleChoice(fc.id, opt.value, Number(fc.choice.count) || 1)"
            @details="viewId = opt.value"
          />
        </div>

        <div v-else-if="isChips(fc.choice)" class="chips">
          <button
            v-for="opt in choiceOptionList(fc)"
            :key="opt.value"
            class="chip"
            :class="{ on: isSel(fc, opt), off: locked(fc, opt) }"
            @click="toggleChoice(fc.id, opt.value, Number(fc.choice.count) || 1)"
          >{{ opt.label }}</button>
        </div>

        <div v-else class="list">
          <div
            v-for="opt in choiceOptionList(fc)"
            :key="opt.value"
            class="opt"
            :class="{ on: isSel(fc, opt), off: locked(fc, opt) }"
            @click="toggleChoice(fc.id, opt.value, Number(fc.choice.count) || 1)"
          >
            <span class="box" :class="{ radio: (Number(fc.choice.count) || 1) === 1 }">
              <svg v-if="isSel(fc, opt)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 6" /></svg>
            </span>
            <div class="opt-body">
              <div class="opt-label">{{ opt.label }}</div>
              <div v-if="opt.desc" class="opt-desc">{{ opt.desc }}</div>
            </div>
          </div>
        </div>
      </template>
    </template>

    <ItemViewModal
      v-if="viewId != null"
      :item-type-id="5"
      :item-id="viewId"
      @close="viewId = null"
    />
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
import MultiSearchSelect from '@/features/character-list/components/wizard/MultiSearchSelect.vue'
import SkillPicker from '@/features/character-list/components/wizard/SkillPicker.vue'
import SpellSelectTile from '@/features/character-list/components/wizard/SpellSelectTile.vue'
import { choicePresentation } from '@/features/character-list/components/wizard/choicePresentation'
import { useSuggestStore } from '@/stores/suggest'

const props = defineProps({
  scope: { type: String, default: 'all' },
  compact: { type: Boolean, default: false },
})
const wz = inject('createWizard')
const { featureChoices, raceFeatureChoices, classFeatureChoices, choiceOptionList, choiceSelected, toggleChoice } = wz
const viewId = ref(null)
const suggestStore = useSuggestStore()
suggestStore.ensure(7)
const schoolMap = computed(() => new Map(suggestStore.items(7).map((entry) => [String(entry.id), entry.value])))
const list = computed(() => (
  props.scope === 'race' ? raceFeatureChoices.value
    : props.scope === 'class' ? classFeatureChoices.value
      : featureChoices.value
))

function isSel(fc, opt) { return choiceSelected(fc.id).some((v) => String(v) === String(opt.value)) }
function locked(fc, opt) {
  const count = Number(fc.choice.count) || 1
  return count > 1 && !isSel(fc, opt) && choiceSelected(fc.id).length >= count
}
function isChips(choice) { return choicePresentation(choice) === 'chips' }
function isLangChoice(choice) { return choicePresentation(choice) === 'language' }
function isSkillChoice(choice) { return choicePresentation(choice) === 'skill' }
function isSpellChoice(choice) { return choice?.source === 'item' && Number(choice?.from_item_type_id) === 5 }
function schoolName(spell) { return schoolMap.value.get(String(spell?.data?.schoolId)) || '' }
function optionsFor(fc) { return choiceOptionList(fc).map((o) => ({ id: o.value, name: o.label })) }
function skillOptionsFor(fc) { return choiceOptionList(fc).map((o) => ({ id: o.value, name: o.label, desc: o.desc || '' })) }
</script>

<style scoped>
.step { display: flex; flex-direction: column; gap: 11px; }
.count { font-size: 12px; font-weight: 600; color: var(--text-muted); letter-spacing: 0; text-transform: none; }
.count.done { color: var(--success); }
.hint { font-size: 12px; color: var(--text-muted); margin: 0; }
.chips { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 4px; }
.chip {
  display: inline-flex; align-items: center; gap: 5px;
  background: var(--surface); border: none; border-radius: 999px;
  color: var(--text-2); font: inherit; font-size: 12px; padding: 6px 13px; cursor: pointer; transition: background 0.15s;
}
.chip:hover { background: color-mix(in srgb, var(--accent) 14%, var(--surface)); }
.chip.on { background: var(--accent); color: var(--text-on-accent); }
.chip.off { opacity: 0.4; cursor: default; }
.chip.off:hover { background: var(--surface); }
.spell-list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; margin-bottom: 4px; }
.step--compact .spell-list { grid-template-columns: 1fr; }
.list { display: flex; flex-direction: column; gap: 7px; margin-bottom: 4px; }
.opt {
  display: flex; align-items: flex-start; gap: 11px;
  background: var(--surface); border-radius: var(--r-md);
  padding: 11px 13px; cursor: pointer; transition: background 0.15s;
}
.opt:hover { background: color-mix(in srgb, var(--accent) 12%, var(--surface)); }
.opt.on { background: color-mix(in srgb, var(--accent) 16%, var(--surface)); }
.opt.off { opacity: 0.45; cursor: default; }
.opt.off:hover { background: var(--surface); }
.box {
  flex-shrink: 0; width: 18px; height: 18px; margin-top: 1px; border-radius: 5px;
  background: var(--surface-raised); display: flex; align-items: center; justify-content: center;
}
.box.radio { border-radius: 50%; }
.opt.on .box { background: var(--accent); }
.box svg { width: 12px; height: 12px; color: var(--text-on-accent); }
.opt-body { min-width: 0; }
.opt-label { font-size: 14px; color: var(--text-1); font-weight: 500; }
.opt-desc { font-size: 12px; color: var(--text-muted); margin-top: 2px; line-height: 1.4; }
@media (max-width: 900px) { .spell-list { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 560px) { .spell-list { grid-template-columns: 1fr; } }
</style>
