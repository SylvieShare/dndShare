<template>
  <div class="step">
    <div class="sheet-section-title">
      Владение навыками
      <span class="count" :class="{ done: limit && selected.length === limit }">{{ selected.length }} / {{ limit }}</span>
    </div>
    <p class="hint">{{ source === 'race' ? 'Раса даёт владение выбранными навыками — бонус мастерства прибавляется к профильной характеристике.' : 'От класса ты владеешь выбранными навыками — бонус мастерства прибавляется к профильной характеристике.' }}</p>
    <p v-if="!options.length" class="hint">{{ source === 'race' ? 'Раса не предлагает выбор навыков.' : 'Класс не предлагает выбор навыков.' }}</p>

    <div class="list">
      <div
        v-for="opt in options"
        :key="opt.id"
        class="skill"
        :class="{ on: selected.includes(opt.id), off: !selected.includes(opt.id) && atLimit }"
        @mouseenter="showSkillTooltip($event, opt)"
        @mouseleave="tooltip.visible = false"
        @click="toggle(opt.id)"
      >
        <span class="box">
          <svg v-if="selected.includes(opt.id)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 6" /></svg>
        </span>
        <span class="sk-name">{{ opt.name }}</span>
        <span v-if="skillStat(opt.id)" class="sk-abil">{{ STAT_SHORT[skillStat(opt.id)] }}</span>
        <span class="sk-mod" :class="modClass(skillMod(opt.id))">{{ formatMod(skillMod(opt.id)) }}</span>
      </div>
    </div>
    <ItemTooltip
      v-if="tooltip.visible"
      :title="tooltip.title"
      :desc="tooltip.desc"
      :x="tooltip.x"
      :top="tooltip.top"
      :bottom="tooltip.bottom"
    />
  </div>
</template>

<script setup>
import { computed, inject, reactive } from 'vue'
import { STAT_SHORT, formatMod } from '@/features/character-list/components/wizard/labels'
import ItemTooltip from '@/features/character-editor/components/ItemTooltip.vue'

const props = defineProps({ source: { type: String, default: 'class' } })
const { state, skillOptions, skillLimit, toggleSkill, raceSkillOptions, raceSkillLimit, toggleRaceSkill, skillStat, skillMod } = inject('createWizard')
const options = computed(() => props.source === 'race' ? raceSkillOptions.value : skillOptions.value)
const limit = computed(() => props.source === 'race' ? raceSkillLimit.value : skillLimit.value)
const selected = computed(() => props.source === 'race' ? state.raceSkillIds : state.skillIds)
const toggle = (id) => (props.source === 'race' ? toggleRaceSkill(id) : toggleSkill(id))
const atLimit = computed(() => limit.value > 0 && selected.value.length >= limit.value)
function modClass(m) { return m > 0 ? 'pos' : m < 0 ? 'neg' : '' }
const tooltip = reactive({ visible: false, title: '', desc: '', x: 0, top: null, bottom: null })
function showSkillTooltip(event, option) {
  if (!option.desc) return
  const rect = event.currentTarget.getBoundingClientRect()
  const above = window.innerHeight - rect.bottom < 220 && rect.top > 220
  Object.assign(tooltip, {
    visible: true,
    title: option.name,
    desc: option.desc,
    x: Math.min(rect.left, window.innerWidth - 360),
    top: above ? null : rect.bottom + 7,
    bottom: above ? window.innerHeight - rect.top + 7 : null,
  })
}
</script>

<style scoped>
.step { display: flex; flex-direction: column; gap: 12px; }
.count { font-size: 12px; font-weight: 600; color: var(--text-muted); letter-spacing: 0; text-transform: none; }
.count.done { color: var(--success); }
.hint { font-size: 12px; color: var(--text-muted); margin: 0; }
.list { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 6px; }
.skill {
  display: flex; align-items: center; gap: 10px;
  background: var(--surface); border-radius: var(--r-md);
  padding: 9px 12px; cursor: pointer; transition: background 0.15s;
}
.skill:hover { background: color-mix(in srgb, var(--accent) 12%, var(--surface)); }
.skill.on { background: color-mix(in srgb, var(--accent) 16%, var(--surface)); }
.skill.off { opacity: 0.45; cursor: default; }
.skill.off:hover { background: var(--surface); }
.box {
  flex-shrink: 0; width: 18px; height: 18px; border-radius: 5px;
  background: var(--surface-raised); display: flex; align-items: center; justify-content: center;
}
.skill.on .box { background: var(--accent); }
.box svg { width: 12px; height: 12px; color: var(--text-on-accent); }
.sk-name { flex: 1; font-size: 13px; color: var(--text-1); }
.sk-abil { font-size: 10px; letter-spacing: 0.04em; color: var(--text-muted); }
.sk-mod { font-size: 12px; font-weight: 600; color: var(--text-2); font-variant-numeric: tabular-nums; min-width: 24px; text-align: right; }
.sk-mod.pos { color: var(--success); }
.sk-mod.neg { color: var(--danger); }
</style>
