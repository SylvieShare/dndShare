<template>
  <span class="dd" :style="{ '--dd-size': `${size}px`, '--dd-font-size': `${Math.max(12, Math.round(size * .38))}px` }">
    <template v-for="(g, gi) in groups" :key="gi">
      <span v-if="gi > 0" class="dd-op dd-op-between">+</span>
      <span class="dd-grp" :style="{ '--dc': g.typeColor }">
        <span class="dd-dice">
          <template v-if="g.dice.length">
            <template v-for="(term, ti) in g.terms" :key="ti">
              <span v-if="ti > 0" class="dd-op">+</span>
              <template v-for="(variant, vi) in term" :key="vi">
                <span v-if="vi > 0" class="dd-op" title="Одной рукой / двумя руками">/</span>
                <span v-if="!variant.length" class="dd-term">0</span>
                <span v-if="term.length > 1 && variant.length > 1" class="dd-op">(</span>
                <template v-for="(part, pi) in variant" :key="pi">
                  <span v-if="pi > 0" class="dd-op">+</span>
                  <span v-if="part.count !== 1" class="dd-count">{{ part.count }}</span>
                  <SystemDie
                    v-if="part.diceSides"
                    :sides="part.diceSides"
                    :size="size"
                    :color="g.typeColor"
                  />
                  <span v-else class="dd-text">{{ dieText(part) }}</span>
                </template>
                <span v-if="term.length > 1 && variant.length > 1" class="dd-op">)</span>
              </template>
            </template>
            <template v-if="g.modifier !== 0">
              <span class="dd-op">{{ g.modifier > 0 ? '+' : '−' }}</span>
              <span class="dd-term">{{ Math.abs(g.modifier) }}</span>
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
import SystemDie from '@/shared/ui/SystemDie.vue'

// Shared dice display: damage/heal parts (`{ count, diceLabel, diceSides, type, typeColor }` — the shape both
// spell `dicePart` and weapon `attackDisplay` produce) grouped **by damage type**. Each group renders its
// dice (+ the flat `modifier`, which attaches to the first group: positive sits left, negative right) on one
// row with a **single type label underneath**. The die is the system polyhedron (`diceSides`); `dieText`
// (`8d6`/`d10`) is the text fallback. Colour comes from the type (`typeColor` → `--dc`, `defaultColor` fallback).
const props = defineProps({
  parts: { type: Array, default: () => [] },
  alternativeParts: { type: Array, default: () => [] },
  modifier: { type: Number, default: 0 },
  defaultColor: { type: String, default: 'var(--warning)' },
  size: { type: Number, default: 42 },
})

const groups = computed(() => {
  const out = []
  for (const [alternative, parts] of [props.parts, props.alternativeParts].entries()) {
    for (const p of parts) {
      if (!p.diceSides && !p.diceLabel && !p.label) continue
      const key = `${p.type || ''}|${p.typeColor || ''}`
      let g = out.find(x => x.key === key)
      if (!g) {
        g = { key, type: p.type || '', typeColor: p.typeColor || props.defaultColor, dice: [], alternatives: [], modifier: 0 }
        out.push(g)
      }
      const target = alternative ? g.alternatives : g.dice
      target.push(p)
    }
  }
  for (const g of out) {
    g.terms = damageTerms(g.dice, g.alternatives)
    if (!g.dice.length) g.dice = g.alternatives
  }
  if (props.modifier) {
    if (out.length) out[0].modifier = props.modifier
    else out.push({ key: '', type: '', typeColor: props.defaultColor, dice: [], terms: [], modifier: props.modifier })
  }
  return out
})

// Keep dice shared by both grips (including extra damage) and the flat bonus only once.
function damageTerms(dice, alternatives) {
  if (!props.alternativeParts.length) return [[dice]]
  const remaining = [...alternatives]
  const common = []
  const oneHanded = []
  for (const part of dice) {
    const index = remaining.findIndex(other => other.count === part.count
      && other.diceSides === part.diceSides && dieText(other) === dieText(part))
    if (index < 0) oneHanded.push(part)
    else common.push(remaining.splice(index, 1)[0])
  }
  const terms = []
  if (oneHanded.length || remaining.length) terms.push([oneHanded, remaining])
  if (common.length) terms.push([common])
  return terms
}

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

.dd-count,
.dd-text,
.dd-term { color: var(--dc); font-size: var(--dd-font-size); font-weight: 800; }

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
  height: var(--dd-size);
}
</style>
