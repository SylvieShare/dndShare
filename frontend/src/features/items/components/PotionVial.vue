<template>
  <span class="pv" :class="[`pv-${size}`, animClass]" :style="{ '--pv-lc': liquidColor }">
    <span class="pv-scale">
      <span class="pv-inner" :class="`r-${preset.code}`">
        <span v-if="hasFrame" class="pv-frame"></span>
        <template v-if="preset.code === 'artifact'">
          <span class="pv-rune pv-rune1">ᚱ</span>
          <span class="pv-rune pv-rune2">ᛟ</span>
          <span class="pv-rune pv-rune3">ᚠ</span>
        </template>
        <template v-if="preset.code === 'legendary'">
          <span class="pv-spark pv-spark1"></span>
          <span class="pv-spark pv-spark2"></span>
          <span class="pv-spark pv-spark3"></span>
        </template>
        <span v-if="hasGem" class="pv-gem"></span>
        <span class="pv-wisp"></span>
        <span class="pv-cork"></span>
        <span class="pv-glass">
          <span class="pv-liquid"></span>
          <span class="pv-shine"></span>
          <span class="pv-bub pv-bub1"></span>
          <span class="pv-bub pv-bub2"></span>
        </span>
      </span>
    </span>
  </span>
</template>

<script setup>
import { computed, onUnmounted, ref } from 'vue'

import { rarityOf } from '@/features/items/lib/potionRarity'

const props = defineProps({
  color: { type: String, default: null },
  rarity: { type: Number, default: 0 },
  size: { type: String, default: 'md' },
})

const preset = computed(() => rarityOf(props.rarity))
const hasGem = computed(() => ['rare', 'very_rare', 'artifact'].includes(preset.value.code))
const hasFrame = computed(() => ['very_rare', 'artifact'].includes(preset.value.code))
const liquidColor = computed(() => props.color || 'var(--accent)')

const anim = ref('idle')
const animClass = computed(() => (anim.value === 'idle' ? '' : `pv-${anim.value}`))

let timer = null
function clearTimer() { if (timer) { clearTimeout(timer); timer = null } }

function playDrain() {
  clearTimer()
  anim.value = 'draining'
  return new Promise(resolve => { timer = setTimeout(resolve, 650) })
}
function playRefill() {
  clearTimer()
  anim.value = 'refill'
  timer = setTimeout(() => { anim.value = 'idle' }, 460)
}
function playSpent() {
  clearTimer()
  anim.value = 'spent'
  return new Promise(resolve => { timer = setTimeout(resolve, 560) })
}
function resetAnim() { clearTimer(); anim.value = 'idle' }

onUnmounted(clearTimer)
defineExpose({ playDrain, playRefill, playSpent, resetAnim })
</script>

<style scoped>
.pv { position: relative; display: inline-flex; justify-content: center; }
.pv-sm { --s: 0.56; width: 24px; height: 60px; }
.pv-md { --s: 1; width: 42px; height: 106px; }
.pv-lg { --s: 1.4; width: 59px; height: 148px; }

.pv-scale {
  transform: scale(var(--s));
  transform-origin: top center;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 42px;
}

.pv-inner {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 42px;
  transform-origin: bottom center;
}

.pv-cork {
  width: 22px;
  height: 12px;
  background: #7a5c3a;
  border: 1px solid #5e4327;
  border-bottom: none;
  border-radius: 6px 6px 2px 2px;
  box-shadow: inset 0 2px 0 #93704a;
  z-index: 3;
  transition: transform 0.3s;
}

.pv-glass {
  position: relative;
  width: 42px;
  height: 94px;
  margin-top: -1px;
  background: #0d0e15;
  border: 1.5px solid #3a3d4d;
  border-radius: 6px 6px 15px 15px;
  overflow: hidden;
  z-index: 2;
}

.pv-liquid {
  position: absolute;
  left: 3px;
  right: 3px;
  bottom: 3px;
  height: 66%;
  border-radius: 3px 3px 12px 12px;
  background: var(--pv-lc);
  box-shadow: 0 0 9px var(--pv-lc);
  border-top: 2px solid rgba(255, 255, 255, 0.5);
  transition: height 0.5s cubic-bezier(0.5, 0, 0.2, 1);
}

.pv-shine {
  position: absolute;
  top: 7px;
  left: 6px;
  width: 5px;
  height: 54px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  z-index: 4;
}

.pv-bub { position: absolute; border-radius: 50%; background: rgba(255, 255, 255, 0.4); z-index: 3; }
.pv-bub1 { left: 14px; width: 4px; height: 4px; animation: pv-rise 3.4s ease-in infinite; }
.pv-bub2 { left: 25px; width: 3px; height: 3px; animation: pv-rise 4.2s ease-in 0.8s infinite; }
@keyframes pv-rise {
  0% { bottom: 8px; opacity: 0; }
  20% { opacity: 0.6; }
  100% { bottom: 64px; opacity: 0; }
}

.pv-gem {
  position: absolute;
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 7px;
  height: 7px;
  border-radius: 50%;
  z-index: 4;
}

.pv-wisp {
  position: absolute;
  top: 4px;
  left: 50%;
  width: 16px;
  height: 16px;
  margin-left: -8px;
  border-radius: 50%;
  background: var(--pv-lc);
  filter: blur(4px);
  opacity: 0;
  z-index: 5;
  pointer-events: none;
}

/* common */
.r-common .pv-glass { border-color: #454857; }

/* uncommon */
.r-uncommon .pv-glass { border-color: #4fae6a; box-shadow: 0 0 11px rgba(79, 174, 106, 0.45); }
.r-uncommon .pv-cork { box-shadow: inset 0 2px 0 #93704a, 0 -2px 0 #4fae6a; }

/* rare */
.r-rare .pv-glass { border-color: #4f8fe0; box-shadow: 0 0 16px rgba(79, 143, 224, 0.6); }
.r-rare .pv-gem { background: #7fb6ff; box-shadow: 0 0 7px #4f8fe0; }

/* very rare */
.r-very_rare .pv-glass { border-color: #a26cf0; animation: pv-aura-v 2.4s ease-in-out infinite; }
@keyframes pv-aura-v {
  0%, 100% { box-shadow: 0 0 14px rgba(162, 108, 240, 0.5); }
  50% { box-shadow: 0 0 22px rgba(162, 108, 240, 0.85); }
}
.r-very_rare .pv-frame { position: absolute; top: -5px; left: -5px; right: -5px; bottom: -5px; border: 1.5px solid rgba(162, 108, 240, 0.5); border-radius: 9px 9px 18px 18px; z-index: 1; }
.r-very_rare .pv-gem { background: #c89cff; box-shadow: 0 0 8px #a26cf0; }

/* legendary */
.r-legendary .pv-glass { border-color: #f0b03c; animation: pv-aura-l 2s ease-in-out infinite; }
@keyframes pv-aura-l {
  0%, 100% { box-shadow: 0 0 16px rgba(240, 176, 60, 0.55); }
  50% { box-shadow: 0 0 30px rgba(240, 176, 60, 0.95); }
}
.r-legendary .pv-cork { width: 26px; height: 13px; background: #e0a838; border-color: #a87d22; border-radius: 8px 8px 4px 4px; box-shadow: inset 0 2px 0 #f5cf6a; }
.r-legendary .pv-spark { position: absolute; border-radius: 50%; background: #ffe9a8; box-shadow: 0 0 6px #f0c860; z-index: 5; }
.r-legendary .pv-spark1 { top: 12px; left: -6px; width: 4px; height: 4px; animation: pv-tw 1.8s ease-in-out infinite; }
.r-legendary .pv-spark2 { top: 30px; right: -7px; width: 3px; height: 3px; animation: pv-tw 2.3s ease-in-out 0.5s infinite; }
.r-legendary .pv-spark3 { top: 54px; left: -7px; width: 3px; height: 3px; animation: pv-tw 2s ease-in-out 1s infinite; }
@keyframes pv-tw {
  0%, 100% { opacity: 0; transform: scale(0.5); }
  50% { opacity: 1; transform: scale(1); }
}

/* artifact */
.r-artifact .pv-glass { border-color: #e0524e; background: #120c0f; animation: pv-aura-a 1.7s ease-in-out infinite; }
@keyframes pv-aura-a {
  0%, 100% { box-shadow: 0 0 16px rgba(224, 82, 78, 0.6); }
  50% { box-shadow: 0 0 30px rgba(224, 82, 78, 1); }
}
.r-artifact .pv-frame { position: absolute; top: -6px; left: -6px; right: -6px; bottom: -6px; border: 1.5px solid rgba(224, 82, 78, 0.45); border-radius: 10px 10px 20px 20px; z-index: 1; }
.r-artifact .pv-cork { background: #3a2a2a; border-color: #1f1414; box-shadow: inset 0 2px 0 #5a3e3e; }
.r-artifact .pv-gem { background: #ff7b6e; box-shadow: 0 0 9px #e0524e; }
.r-artifact .pv-rune { position: absolute; font-size: 13px; color: #ff8a7e; text-shadow: 0 0 7px #e0524e; z-index: 5; animation: pv-float 3s ease-in-out infinite; }
.r-artifact .pv-rune1 { top: 8px; left: -12px; }
.r-artifact .pv-rune2 { top: 40px; right: -13px; animation-delay: 1s; }
.r-artifact .pv-rune3 { top: 66px; left: -11px; animation-delay: 1.8s; }
@keyframes pv-float {
  0%, 100% { opacity: 0.25; transform: translateY(2px); }
  50% { opacity: 0.95; transform: translateY(-3px); }
}

/* ─── Drink animation (full gulp → replace / empty). Placed after rarity rules
       so the one-shot glow flash overrides the continuous rarity aura. ─── */
.pv-draining .pv-liquid { height: 0; }
.pv-draining .pv-inner { animation: pv-tip 0.6s ease-in-out; }
.pv-draining .pv-cork { transform: translateY(-7px); }
.pv-draining .pv-glass { animation: pv-flash 0.6s ease-out; }
.pv-draining .pv-wisp { animation: pv-wisp 1s ease-out; }
@keyframes pv-tip {
  0% { transform: rotate(0); }
  45% { transform: rotate(10deg) translateY(-2px); }
  100% { transform: rotate(0); }
}
@keyframes pv-flash {
  0% { box-shadow: 0 0 6px var(--pv-lc); }
  40% { box-shadow: 0 0 26px var(--pv-lc); }
  100% { box-shadow: 0 0 4px transparent; }
}
@keyframes pv-wisp {
  0% { opacity: 0; transform: translateY(6px) scale(0.5); }
  25% { opacity: 0.85; }
  100% { opacity: 0; transform: translateY(-46px) scale(1.8); }
}

.pv-refill .pv-glass { animation: pv-swap 0.45s ease-out; }
@keyframes pv-swap {
  0% { opacity: 0.18; transform: translateY(5px) scale(0.96); }
  100% { opacity: 1; transform: none; }
}

.pv-spent .pv-liquid { height: 0; }
.pv-spent .pv-inner { animation: pv-vanish 0.55s ease-in forwards; }
.pv-spent .pv-cork { transform: translateY(-3px) rotate(-12deg); }
@keyframes pv-vanish {
  0% { opacity: 1; }
  100% { opacity: 0.15; transform: translateY(6px) scale(0.92); }
}
</style>
