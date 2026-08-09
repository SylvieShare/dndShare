<template>
  <div class="step">
    <div class="sheet-section-title">
      Владение навыками
      <span class="count" :class="{ done: skillLimit && state.skillIds.length === skillLimit }">{{ state.skillIds.length }} / {{ skillLimit }}</span>
    </div>
    <p class="hint">От класса ты владеешь выбранными навыками — бонус мастерства прибавляется к профильной характеристике.</p>
    <p v-if="!skillOptions.length" class="hint">Класс не предлагает выбор навыков.</p>

    <div class="list">
      <div
        v-for="opt in skillOptions"
        :key="opt.id"
        class="skill"
        :class="{ on: state.skillIds.includes(opt.id), off: !state.skillIds.includes(opt.id) && atLimit }"
        @click="toggleSkill(opt.id)"
      >
        <span class="box">
          <svg v-if="state.skillIds.includes(opt.id)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 6" /></svg>
        </span>
        <span class="sk-name">{{ opt.name }}</span>
        <span v-if="skillStat(opt.id)" class="sk-abil">{{ STAT_SHORT[skillStat(opt.id)] }}</span>
        <span class="sk-mod" :class="modClass(skillMod(opt.id))">{{ formatMod(skillMod(opt.id)) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { STAT_SHORT, formatMod } from '@/features/character-list/components/wizard/labels'

const { state, skillOptions, skillLimit, skillStat, skillMod, toggleSkill } = inject('createWizard')
const atLimit = computed(() => skillLimit.value > 0 && state.skillIds.length >= skillLimit.value)
function modClass(m) { return m > 0 ? 'pos' : m < 0 ? 'neg' : '' }
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
