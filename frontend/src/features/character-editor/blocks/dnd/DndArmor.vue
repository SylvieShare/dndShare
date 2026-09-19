<template>
  <StatTile
    :variant="variant"
    label="КД"
    :mini-label="`КД${armorState.shield ? ' +Щ' : ''}`"
    :value="armorState.total"
    :icon="iconSrc"
    :toggled="!!armorState.shield"
  >
    <template #tile="{ open, canEdit, attrs }">
      <MorphTile v-bind="attrs" compact-header :title="block.title || 'КД'" :show-edit="canEdit" edit-label="Редактировать" @edit="open" class="armor-tile">
        <button class="armor-btn" :class="{ 'armor-toggled': armorState.shield }" type="button" @click="open">
          <div class="armor-shield-wrap"><div class="armor-shield-icon"></div><span class="armor-num">{{ armorState.total }}</span></div>
        </button>
      </MorphTile>
    </template>

    <template #editor>
      <EditorPanel title="Класс доспеха (КД)">
        <EditorSection title="Экипировка">
          <div class="armor-source">
            <span><b>{{ armorState.body?.name || armorState.abilityFormula?.source_label || 'Без доспеха' }}</b><small>{{ bodyFormula }}</small></span>
            <strong>{{ armorState.body?.value ?? armorState.abilityFormula?.value ?? 10 + armorState.dexterity }}</strong>
          </div>
          <div v-if="armorState.shield" class="armor-source">
            <span><b>{{ armorState.shield.name }}</b><small>Экипированный щит</small></span>
            <strong>+{{ armorState.shield.value }}</strong>
          </div>
          <div v-else class="armor-empty">Щит не экипирован</div>
          <div v-for="bonus in armorState.abilityBonuses" :key="bonus.key" class="armor-source">
            <span><b>{{ bonus.source_label }}</b><small>{{ bonus.label || 'Бонус способности' }}</small></span>
            <strong>{{ signed(bonus.value) }}</strong>
          </div>
          <div v-if="armorState.bodyConflict || armorState.shieldConflict" class="armor-warning">
            Одновременно учитывается только {{ armorState.bodyConflict ? 'доспех с наибольшим КД' : '' }}{{ armorState.bodyConflict && armorState.shieldConflict ? ' и ' : '' }}{{ armorState.shieldConflict ? 'щит с наибольшим бонусом' : '' }}.
          </div>
          <div v-if="armorState.nonproficient.length" class="armor-warning armor-warning--danger">
            Нет владения: {{ armorState.nonproficient.map(row => row.name).join(', ') }}. <template v-if="armorState.castingBlocked">Помеха на проверки, спасброски и атаки Силой или Ловкостью; сотворение заклинаний недоступно.</template><template v-else>Щит без владения не увеличивает КД.</template>
          </div>
        </EditorSection>
        <EditorSection title="Дополнительные бонусы">
          <BonusList :bonuses="armorData.bonuses || []" @update:bonuses="setBonuses" />
        </EditorSection>
        <div v-if="armorState.minimum" class="armor-source">
          <span><b>{{ armorState.minimum.source_label }}</b><small>Минимум итогового КД с учётом всех бонусов</small></span>
          <strong>Не ниже {{ armorState.minimum.value }}</strong>
        </div>
        <EditorTotal>КД: <strong>{{ armorState.total }}</strong></EditorTotal>
      </EditorPanel>
    </template>
  </StatTile>
</template>

<script setup>
import { MorphTile } from '@sylvieshare/share-ui'
import { computed, inject } from 'vue'
import BonusList from '@/shared/ui/BonusList'
import { EditorPanel, EditorSection, EditorTotal } from '@sylvieshare/share-ui'
import StatTile from '@/features/character-editor/blocks/dnd/components/StatTile'
import { deriveEquippedArmor } from '@/features/character-editor/blocks/dnd/lib/equippedArmor'

const props = defineProps(['block', 'value', 'values'])
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', {})

const variant = computed(() => props.block?.props?.variant || props.block?.content?.variant || '')
const iconSrc = computed(() => props.block?.content?.svg || null)
const armorData = computed(() => props.value && typeof props.value === 'object' ? props.value : { bonuses: [] })
const armorState = computed(() => charCtx.characterArmor?.state || deriveEquippedArmor(props.values))
const bodyFormula = computed(() => {
  const body = armorState.value.body
  const formula = armorState.value.abilityFormula
  if (!body && formula) {
    const mods = (formula.modifiers || []).map(signed).join(' + ')
    return `${formula.base || 10}${mods ? ` + ${mods}` : ''}`
  }
  if (!body) return `10 ${armorState.value.dexterity >= 0 ? '+' : '−'} ${Math.abs(armorState.value.dexterity)} Ловкости`
  if (body.item?.data?.armor?.use_dex === false) return 'Базовый КД доспеха'
  const cap = body.item?.data?.armor?.dex_cap
  return cap == null ? `С Ловкостью (${signed(body.dex)})` : `С Ловкостью (${signed(body.dex)}, максимум +${cap})`
})

function signed(value) { return `${Number(value) >= 0 ? '+' : ''}${Number(value) || 0}` }
function setBonuses(bonuses) { emit('update:value', props.block.id, { bonuses }) }
</script>

<style scoped>
.armor-tile { display: flex; flex-direction: column; align-items: stretch; }
.armor-btn { background: none; border: none; padding: 0; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 5px; border-radius: 6px; }
.armor-shield-wrap { position: relative; display: flex; align-items: center; justify-content: center; }
.armor-shield-icon { width: 68px; height: 74px; background-color: var(--surface-raised); mask: url('/static/shield.svg') center / contain no-repeat; -webkit-mask: url('/static/shield.svg') center / contain no-repeat; transition: background-color .25s, filter .25s; }
.armor-toggled .armor-shield-icon { background-color: var(--accent); filter: drop-shadow(0 0 8px color-mix(in srgb, var(--accent) 70%, transparent)); }
.armor-num { position: absolute; inset: 50% auto auto 50%; transform: translate(-50%, -50%); color: var(--text-1); font-size: 26px; font-weight: 800; line-height: 1; }
.armor-toggled .armor-num { color: var(--text-on-accent); }
.armor-source { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 9px 11px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-raised); }
.armor-source span { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.armor-source b { overflow: hidden; color: var(--text-1); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.armor-source small, .armor-empty { color: var(--text-muted); font-size: 11px; }
.armor-source strong { color: var(--accent); font-size: 15px; }
.armor-empty { padding: 5px 2px; }
.armor-warning { padding: 9px 11px; border: 1px solid color-mix(in srgb, var(--warning) 45%, var(--border)); border-radius: 9px; background: color-mix(in srgb, var(--warning) 10%, transparent); color: var(--text-2); font-size: 11px; line-height: 1.45; }
.armor-warning--danger { border-color: color-mix(in srgb, var(--danger) 50%, var(--border)); background: color-mix(in srgb, var(--danger) 9%, transparent); }
</style>
