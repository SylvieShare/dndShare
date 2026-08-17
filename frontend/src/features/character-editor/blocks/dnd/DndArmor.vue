<template>
  <StatTile
    :variant="variant"
    label="КД"
    :mini-label="`КД${armorData.shield ? ' +Щ' : ''}`"
    :value="displayAC"
    :icon="iconSrc"
    :toggled="armorData.shield"
    @action="toggleShield"
  >
    <!-- mobile default: shield graphic — tap the shield to raise it, the pencil to edit -->
    <template #tile="{ open, action }">
      <div class="armor-tile">
        <button class="sb-edit" type="button" title="Редактировать" @click.stop="open">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
        <button class="armor-btn" :class="{ 'armor-toggled': armorData.shield }" type="button" @click="action">
          <div class="armor-shield-wrap">
            <div class="armor-shield-icon"></div>
            <span class="armor-num">{{ displayAC }}</span>
          </div>
          <div v-if="block.title" class="sheet-tile-title armor-label">{{ block.title }}</div>
        </button>
      </div>
    </template>

    <template #editor>
      <EditorPanel title="Класс брони (КБ)">
        <EditorSection title="Основа">
          <FormField label="Основное значение">
            <FormNumberInput :value="armorData.ac" :min="0" :max="99" @change="setAc" />
          </FormField>
          <ToggleSwitch
            v-if="dexMod !== null"
            :modelValue="armorData.use_dex || false"
            :label="`Учитывать ловкость (${appliedDex >= 0 ? '+' : ''}${appliedDex}${armorData.dex_cap != null ? `, максимум +${armorData.dex_cap}` : ''})`"
            @update:modelValue="setUseDex"
          />
        </EditorSection>
        <EditorSection title="Бонусы">
          <BonusList :bonuses="armorData.bonuses || []" @update:bonuses="setBonuses" />
        </EditorSection>
        <EditorSection title="Щит">
          <ToggleSwitch :modelValue="!!armorData.shield" label="Использовать щит" @update:modelValue="setShield" />
          <div v-if="armorData.shield_readonly" class="armor-rule-source">
            <span>{{ armorData.shield_source || 'Экипированный щит' }}</span>
            <strong>+{{ armorData.shield_bonus ?? 2 }}</strong>
            <small>из экипировки</small>
          </div>
          <FormField v-else label="Бонус щита">
            <FormNumberInput :value="armorData.shield_bonus ?? 2" :min="0" :max="20" @change="setShieldBonus" />
          </FormField>
        </EditorSection>
        <EditorTotal>КБ: <strong>{{ baseTotal }}</strong> · со щитом: <strong>{{ baseTotal + (armorData.shield_bonus ?? 2) }}</strong></EditorTotal>
      </EditorPanel>
    </template>
  </StatTile>
</template>

<script setup>
import { computed } from 'vue'
import { abilityModByPath, sumBonuses } from '@/shared/lib/dnd'
import BonusList from '@/shared/ui/BonusList'
import { EditorPanel } from '@sylvieshare/share-ui'
import { EditorSection } from '@sylvieshare/share-ui'
import { EditorTotal } from '@sylvieshare/share-ui'
import { FormField } from '@sylvieshare/share-ui'
import { FormNumberInput } from '@sylvieshare/share-ui'
import StatTile from '@/features/character-editor/blocks/dnd/components/StatTile'
import { ToggleSwitch } from '@sylvieshare/share-ui'

const props = defineProps(['block', 'value', 'values'])
const emit = defineEmits(['update:value'])

const variant = computed(() => props.block?.props?.variant || props.block?.content?.variant || '')
const iconSrc = computed(() => props.block?.content?.svg || null)

const armorData = computed(() => {
  if (props.value && typeof props.value === 'object') return props.value
  return { ac: parseInt(props.value) || 10, shield_bonus: 2, shield: false }
})
const dexMod = computed(() => abilityModByPath(props.values, props.block.content?.dex_mod_path))
const appliedDex = computed(() => {
  const value = dexMod.value ?? 0
  return armorData.value.dex_cap == null ? value : Math.min(value, Number(armorData.value.dex_cap))
})
const baseTotal = computed(() => {
  const d = armorData.value
  const bonuses = sumBonuses(d.bonuses)
  const dex = d.use_dex && dexMod.value !== null ? appliedDex.value : 0
  return (d.ac || 0) + dex + bonuses
})
const displayAC = computed(() => {
  const d = armorData.value
  return d.shield ? baseTotal.value + (d.shield_bonus ?? 2) : baseTotal.value
})

function patch(p) { emit('update:value', props.block.id, { ...armorData.value, ...p }) }
function setAc(v) { patch({ ac: v }) }
function setUseDex(v) { patch({ use_dex: v }) }
function setBonuses(v) { patch({ bonuses: v }) }
function setShield(v) { patch({ shield: v }) }
function toggleShield() { patch({ shield: !armorData.value.shield }) }
function setShieldBonus(v) { patch({ shield_bonus: v }) }
</script>

<style scoped>
/* ── Shield graphic variant (mobile default) ── */
.armor-tile { position: relative; display: flex; align-items: center; justify-content: center; }
.armor-tile .sb-edit {
  position: absolute;
  top: -2px;
  right: -2px;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0.35;
  transition: color 0.15s, opacity 0.15s;
  z-index: 1;
}
@media (hover: hover) { .armor-tile .sb-edit:hover { color: var(--accent); opacity: 1; } }
.armor-tile .sb-edit:focus-visible { color: var(--accent); opacity: 1; }
.armor-btn {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  border-radius: 6px;
  transition: opacity 0.15s;
}
.armor-btn:hover { opacity: 0.82; }
.armor-shield-wrap { position: relative; display: flex; align-items: center; justify-content: center; }
.armor-shield-icon {
  width: 68px;
  height: 74px;
  background-color: var(--surface-raised);
  mask: url("/static/shield.svg") center / contain no-repeat;
  -webkit-mask: url("/static/shield.svg") center / contain no-repeat;
  transition: background-color 0.25s, filter 0.25s;
  flex-shrink: 0;
}
.armor-toggled .armor-shield-icon {
  background-color: var(--accent);
  filter: drop-shadow(0 0 8px color-mix(in srgb, var(--accent) 70%, transparent))
          drop-shadow(0 0 18px color-mix(in srgb, var(--accent) 40%, transparent));
}
.armor-toggled .armor-shield-wrap {
  transform: scale(1.06);
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.armor-num {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--text-1);
  font-size: 26px;
  font-weight: 800;
  line-height: 1;
  text-align: center;
  min-width: 10px;
  pointer-events: none;
  transition: color 0.2s, text-shadow 0.2s;
}
.armor-rule-source { display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; align-items: center; padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
.armor-rule-source strong { color: var(--accent); }
.armor-rule-source small { grid-column: 1 / -1; color: var(--text-muted); font-size: 9px; text-transform: uppercase; letter-spacing: .06em; }
.armor-toggled .armor-num { color: var(--text-on-accent); text-shadow: 0 0 10px color-mix(in srgb, var(--text-on-accent) 50%, transparent); }
</style>
