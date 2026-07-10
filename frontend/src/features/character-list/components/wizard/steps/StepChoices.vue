<template>
  <div class="step">
    <template v-for="fc in list" :key="fc.id">
      <div class="sheet-section-title">
        {{ fc.name }}
        <span class="count" :class="{ done: choiceSelected(fc.id).length === (Number(fc.choice.count) || 1) }">{{ choiceSelected(fc.id).length }} / {{ Number(fc.choice.count) || 1 }}</span>
      </div>
      <p v-if="fc.choice.text" class="hint">{{ fc.choice.text }}</p>

      <div class="list">
        <div
          v-for="opt in choiceOptionList(fc.choice)"
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
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'

const props = defineProps({ scope: { type: String, default: 'all' } })
const wz = inject('createWizard')
const { featureChoices, raceFeatureChoices, classFeatureChoices, choiceOptionList, choiceSelected, toggleChoice } = wz
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
</script>

<style scoped>
.step { display: flex; flex-direction: column; gap: 11px; }
.count { font-size: 12px; font-weight: 600; color: var(--text-muted); letter-spacing: 0; text-transform: none; }
.count.done { color: var(--success); }
.hint { font-size: 12px; color: var(--text-muted); margin: 0; }
.list { display: flex; flex-direction: column; gap: 7px; margin-bottom: 4px; }
.opt {
  display: flex; align-items: flex-start; gap: 11px;
  background: var(--block-bg); border-radius: var(--r-md);
  padding: 11px 13px; cursor: pointer; transition: background 0.15s;
}
.opt:hover { background: color-mix(in srgb, var(--accent) 12%, var(--block-bg)); }
.opt.on { background: color-mix(in srgb, var(--accent) 16%, var(--block-bg)); }
.opt.off { opacity: 0.45; cursor: default; }
.opt.off:hover { background: var(--block-bg); }
.box {
  flex-shrink: 0; width: 18px; height: 18px; margin-top: 1px; border-radius: 5px;
  background: var(--bg); display: flex; align-items: center; justify-content: center;
}
.box.radio { border-radius: 50%; }
.opt.on .box { background: var(--accent); }
.box svg { width: 12px; height: 12px; color: #fff; }
.opt-body { min-width: 0; }
.opt-label { font-size: 14px; color: var(--text-1); font-weight: 500; }
.opt-desc { font-size: 12px; color: var(--text-muted); margin-top: 2px; line-height: 1.4; }
</style>
