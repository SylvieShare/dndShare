<template>
  <span class="dd">
    <template v-for="(g, gi) in groups" :key="gi">
      <span v-if="gi > 0" class="dd-op dd-op-between">+</span>
      <span class="dd-grp" :style="{ '--dc': g.typeColor }">
        <span class="dd-dice">
          <template v-if="g.dice.length">
            <template v-if="g.modifier > 0">
              <span class="dd-term">{{ g.modifier }}</span>
              <span class="dd-op">+</span>
            </template>
            <template v-for="(part, pi) in g.dice" :key="pi">
              <span v-if="pi > 0" class="dd-op">+</span>
              <span v-if="part.count !== 1" class="dd-count">{{ part.count }}</span>
              <span v-if="part.iconUrl" class="dd-icon" v-html="part.iconUrl" aria-hidden="true" />
              <span v-else class="dd-text">{{ dieText(part) }}</span>
            </template>
            <template v-if="g.modifier < 0">
              <span class="dd-op">−</span>
              <span class="dd-term">{{ -g.modifier }}</span>
            </template>
          </template>
          <span v-else class="dd-term">{{ g.modifier > 0 ? '+' + g.modifier : '−' + (-g.modifier) }}</span>
        </span>
        <span v-if="g.type" class="dd-type">{{ g.type }}</span>
      </span>
    </template>
  </span>
</template>

<script setup>
import { computed } from 'vue'

// Shared dice display: damage/heal parts (`{ count, diceLabel, iconUrl, type, typeColor }` — the shape both
// spell `dicePart` and weapon `attackDisplay` produce) grouped **by damage type**. Each group renders its
// dice (+ the flat `modifier`, which attaches to the first group: positive sits left, negative right) on one
// row with a **single type label underneath**. The die is the dice-suggest svg (`iconUrl`); `dieText`
// (`8d6`/`d10`) is the text fallback. Colour comes from the type (`typeColor` → `--dc`, `defaultColor` fallback).
const props = defineProps({
  parts: { type: Array, default: () => [] },
  modifier: { type: Number, default: 0 },
  defaultColor: { type: String, default: '#f2ac4a' },
})

const groups = computed(() => {
  const out = []
  for (const p of props.parts) {
    const key = `${p.type || ''}|${p.typeColor || ''}`
    let g = out.find(x => x.key === key)
    if (!g) {
      g = { key, type: p.type || '', typeColor: p.typeColor || props.defaultColor, dice: [], modifier: 0 }
      out.push(g)
    }
    g.dice.push(p)
  }
  if (props.modifier) {
    if (out.length) out[0].modifier = props.modifier
    else out.push({ key: '', type: '', typeColor: props.defaultColor, dice: [], modifier: props.modifier })
  }
  return out
})

function dieText(part) {
  const m = /(\d+)/.exec(String(part.diceLabel || part.label || ''))
  const die = m ? 'd' + m[1] : (part.diceLabel || part.label || '')
  const count = part.count && part.count !== 1 ? part.count : ''
  return `${count}${die}`
}
</script>

<style scoped>
.dd {
  display: inline-flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 2px 8px;
}

.dd-grp {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  color: var(--dc);
}

.dd-dice {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.dd-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  flex-shrink: 0;
}
.dd-icon :deep(svg) { width: 42px; height: 42px; }

.dd-count,
.dd-text,
.dd-term { color: var(--dc); font-size: 16px; font-weight: 800; }

.dd-type {
  color: var(--dc);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  opacity: 0.9;
  text-align: center;
}

.dd-op { color: var(--text-muted); font-size: 14px; font-weight: 700; }
/* between-group "+" sits at the vertical centre of the die row, not the whole column */
.dd-op-between {
  display: inline-flex;
  align-items: center;
  height: 42px;
}
</style>
