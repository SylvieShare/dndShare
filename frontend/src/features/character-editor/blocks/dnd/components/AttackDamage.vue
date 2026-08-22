<template>
  <div class="ad">
    <button
      v-if="hasAttack"
      type="button"
      class="ad-atk"
      :class="{ 'ad-clickable': rollable }"
      :disabled="!rollable"
      title="Бросок атаки"
      @click.stop="$emit('roll-attack')"
    >
      <span class="ad-atk-label">Атака</span>
      <span>{{ attack }}</span>
    </button>

    <button
      v-if="hasDamage && rollable"
      type="button"
      class="ad-crit ad-clickable"
      title="Бросить критический урон"
      @click.stop="$emit('roll-critical')"
    >Крит</button>

    <button
      v-if="hasDamage"
      type="button"
      class="ad-dmg"
      :class="{ 'ad-clickable': rollable }"
      :disabled="!rollable"
      title="Бросок урона"
      @click.stop="$emit('roll-damage')"
    >
      <DamageDice :parts="damageParts" :modifier="modifier" />
    </button>

    <button
      v-if="twoHandedParts.length"
      type="button"
      class="ad-dmg ad-2h"
      :class="{ 'ad-clickable': rollable }"
      :disabled="!rollable"
      title="Урон двумя руками"
      @click.stop="$emit('roll-damage-two')"
    >
      <span class="ad-2h-label">2р</span>
      <DamageDice :parts="twoHandedParts" :modifier="modifier" />
    </button>

    <button
      v-if="healParts.length"
      type="button"
      class="ad-heal"
      :class="{ 'ad-clickable': rollable }"
      :disabled="!rollable"
      title="Бросок лечения"
      @click.stop="$emit('roll-heal')"
    >
      <span class="ad-heal-mark">♥</span>
      <DamageDice :parts="healParts" :modifier="0" default-color="var(--success)" />
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'

import DamageDice from '@/features/character-editor/blocks/dnd/components/DamageDice.vue'

// Shared attack/damage display used by both spells and weapons. The attack is a bordered pill that rolls
// `1d20 + bonus`; damage/heal are clickable groups of `DamageDice`. `twoHandedParts` renders an extra
// "2р" group for versatile weapons (the same flat `modifier` applies). All rolls are delegated upward.
const props = defineProps({
  attack: { type: String, default: null },          // e.g. "+7"; null/'' → no attack chip
  damageParts: { type: Array, default: () => [] },
  modifier: { type: Number, default: 0 },            // flat damage bonus (stat+magic), shared by 1h & 2h
  twoHandedParts: { type: Array, default: () => [] }, // versatile two-handed dice
  healParts: { type: Array, default: () => [] },
  rollable: { type: Boolean, default: false },
})
defineEmits(['roll-attack', 'roll-damage', 'roll-damage-two', 'roll-critical', 'roll-heal'])

const hasAttack = computed(() => props.attack != null && props.attack !== '')
const hasDamage = computed(() => props.damageParts.length > 0 || props.modifier !== 0)
</script>

<style scoped>
.ad {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  min-width: 0;
}

.ad-atk,
.ad-dmg,
.ad-heal,
.ad-crit {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: none;
  background: none;
  padding: 0;
  font-family: inherit;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  color: inherit;
}

.ad-clickable { cursor: pointer; transition: filter 0.12s, transform 0.08s; }
@media (hover: hover) { .ad-clickable:hover { filter: brightness(1.22); } }
.ad-clickable:active { transform: scale(0.96); }
.ad-atk:disabled,
.ad-dmg:disabled,
.ad-heal:disabled { cursor: default; }

.ad-atk {
  padding: 5px 11px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--accent-soft) 32%, transparent);
  background: color-mix(in srgb, var(--accent-soft) 8%, transparent);
  color: var(--text-1);
  font-size: 15px;
}
.ad-atk-label {
  color: var(--accent-soft);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.ad-dmg { padding: 2px 2px; }

.ad-2h { gap: 7px; }
.ad-2h-label {
  align-self: center;
  flex-shrink: 0;
  padding: 2px 5px;
  border: 1px solid color-mix(in srgb, var(--text-on-accent) 16%, transparent);
  border-radius: 5px;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.ad-heal {
  padding: 5px 10px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--success) 50%, transparent);
  background: color-mix(in srgb, var(--success) 16%, transparent);
  color: var(--success);
  font-size: 15px;
}
.ad-heal-mark { color: var(--success); font-size: 13px; }
.ad-crit { padding: 4px 7px; border: 1px solid color-mix(in srgb, var(--warning) 45%, transparent); border-radius: 7px; background: color-mix(in srgb, var(--warning) 10%, transparent); color: var(--warning); font-size: 9px; letter-spacing: .04em; text-transform: uppercase; }
</style>
