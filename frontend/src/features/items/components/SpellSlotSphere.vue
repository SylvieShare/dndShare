<template>
  <span
    class="ss"
    :class="[charged ? 'ss-on' : 'ss-off', animClass, { 'ss-ro': !interactive, 'ss-ready': ready }]"
    :style="rootStyle"
  >
    <span class="ss-flask">
      <span class="ss-well">
        <span class="ss-liquid"></span>
        <span
          v-for="(b, i) in bubbles"
          :key="i"
          class="ss-bubble"
          :style="b"
        ></span>
        <span class="ss-shine"></span>
      </span>
    </span>
    <span class="ss-wisp"></span>
  </span>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

let uid = 0

const props = defineProps({
  spent:       { type: Boolean, default: false },
  level:       { type: Number, default: 1 },
  size:        { type: Number, default: 30 },
  color:       { type: String, default: null },
  interactive: { type: Boolean, default: true },
})

const i01 = computed(() => {
  const v = (props.level - 1) / 8
  return v < 0 ? 0 : v > 1 ? 1 : v
})

const k = computed(() => props.size / 58)

const rootStyle = computed(() => ({
  '--ss-c': props.color || 'var(--accent)',
  '--ss-g': (0.85 + i01.value * 0.9).toFixed(2),
  '--ss-k': k.value.toFixed(3),
  '--ss-rise': (-30 * k.value).toFixed(1) + 'px',
  width: props.size + 'px',
  height: props.size + 'px',
}))

const charged = computed(() => !props.spent)

function rng(s) {
  s = s >>> 0
  return function () {
    s = s + 0x6d2b79f5 | 0
    let t = Math.imul(s ^ s >>> 15, 1 | s)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

const seed = props.level * 7 + (uid = uid + 1)
const bubbles = computed(() => {
  const r = rng(seed)
  const n = 2 + Math.round(i01.value * 2)
  const list = []
  for (let i = 0; i < n; i++) {
    const left = 30 + r() * 40
    const sz = (3 + r() * 2) * k.value
    list.push({
      left: left.toFixed(0) + '%',
      bottom: (6 + r() * 14).toFixed(0) + '%',
      width: sz.toFixed(1) + 'px',
      height: sz.toFixed(1) + 'px',
      '--d': (3 + r() * 1.4).toFixed(2) + 's',
      'animation-delay': (r() * 2.2).toFixed(2) + 's',
    })
  }
  return list
})

const anim = ref('idle')
const animClass = computed(() => (anim.value === 'idle' ? '' : `ss-${anim.value}`))
const ready = ref(false)

let timer = null
let started = false
function clearTimer() { if (timer) { clearTimeout(timer); timer = null } }

function playCast() {
  clearTimer()
  anim.value = 'draining'
  timer = setTimeout(() => { anim.value = 'idle' }, 600)
}
function playRecharge() {
  clearTimer()
  anim.value = 'charging'
  timer = setTimeout(() => { anim.value = 'idle' }, 520)
}

onMounted(() => {
  started = true
  nextTick(() => { ready.value = true })
})
onUnmounted(clearTimer)
defineExpose({ playCast, playRecharge })

watch(() => props.spent, (v) => {
  if (!started) return
  if (v) playCast(); else playRecharge()
})
</script>

<style scoped>
.ss {
  position: relative;
  display: inline-block;
  cursor: pointer;
  transition: transform 0.12s;
}
.ss:not(.ss-ro):hover { transform: scale(1.12); }
.ss-ro { cursor: default; }

/* glass — matches PotionVial's .pv-glass (dark fill + thin grey border, clips its own outer halo only) */
.ss-flask {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: #0d0e15;
  border: 1.5px solid #3a3d4d;
  transition: box-shadow 0.4s, border-color 0.4s, filter 0.4s;
}

/* round inner well, inset by the glass thickness; clips the liquid to a circle and
   its own glow box-shadow fills the dark glass rim on every side (like the vial). */
.ss-well {
  position: absolute;
  inset: calc(3px * var(--ss-k));
  border-radius: 50%;
  overflow: hidden;
}

.ss-liquid {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 0;
  background: var(--ss-c);
  border-top: 2px solid rgba(255, 255, 255, 0.5);
}
.ss-ready .ss-liquid { transition: height 0.55s cubic-bezier(0.5, 0, 0.2, 1), filter 0.4s; }

.ss-shine {
  position: absolute;
  top: 18%;
  left: 22%;
  width: 26%;
  height: 26%;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.45);
  z-index: 3;
  pointer-events: none;
}

.ss-bubble {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.4);
  opacity: 0;
  z-index: 2;
  pointer-events: none;
}

.ss-wisp {
  position: absolute;
  left: 50%;
  top: 40%;
  width: calc(16px * var(--ss-k));
  height: calc(16px * var(--ss-k));
  transform: translateX(-50%);
  border-radius: 50%;
  background: var(--ss-c);
  filter: blur(calc(4px * var(--ss-k)));
  opacity: 0;
  z-index: 4;
  pointer-events: none;
}

/* ── charged (idle) ── */
.ss-on .ss-liquid { height: 100%; }
.ss-on .ss-flask {
  border-color: color-mix(in srgb, var(--ss-c) 50%, #3a3d4d);
}
.ss-on .ss-bubble { animation: ss-bub var(--d) ease-in infinite; }

/* ── spent (idle) ── */
.ss-off .ss-liquid { height: 0; }

/* ── drain (discharge) ── */
.ss-draining .ss-liquid { height: 0; }
.ss-draining .ss-flask { animation: ss-flash 0.6s ease-out; }
.ss-draining .ss-wisp { animation: ss-wisp 1s ease-out; }

/* ── charge (recharge) ── */
.ss-charging .ss-liquid { height: 100%; }
.ss-charging .ss-flask { animation: ss-swap 0.5s ease-out; }

@keyframes ss-bub {
  0% { transform: translateY(0) scale(0.6); opacity: 0; }
  18% { opacity: 0.6; }
  100% { transform: translateY(var(--ss-rise)) scale(1); opacity: 0; }
}
@keyframes ss-flash {
  0% { box-shadow: 0 0 calc(6px * var(--ss-k)) var(--ss-c); }
  40% { box-shadow: 0 0 calc(22px * var(--ss-g) * var(--ss-k)) var(--ss-c); }
  100% { box-shadow: none; }
}
@keyframes ss-swap {
  0% { box-shadow: 0 0 calc(18px * var(--ss-g) * var(--ss-k)) var(--ss-c); filter: brightness(1.4); }
  100% { box-shadow: none; }
}
@keyframes ss-wisp {
  0% { opacity: 0; transform: translateX(-50%) translateY(calc(6px * var(--ss-k))) scale(0.5); }
  25% { opacity: 0.8; }
  100% { opacity: 0; transform: translateX(-50%) translateY(var(--ss-rise)) scale(1.7); }
}

@media (prefers-reduced-motion: reduce) {
  .ss-on .ss-bubble { animation: none !important; }
}
</style>
