<template>
  <CharacterRollDialog v-if="attack || option" :title="title" @close="emit('close')">
    <template #preview>
      <div class="spell-roll-preview">
        <DamageFormulaPreview v-if="expression" unframed :size="32" :label="previewLabel" :expression="expression" :default-color="previewColor"
          :aria-label="attack ? 'Итоговая формула атаки' : option.kind === 'damage' ? 'Итоговая формула урона' : option.kind === 'heal' ? 'Итоговая формула лечения' : 'Итоговая формула эффекта'" />
        <small v-if="attack && attackDraft.mode !== 'normal'">{{ attackDraft.mode === 'advantage' ? 'Преимущество' : 'Помеха' }}</small>
        <template v-if="option?.kind === 'save'"><strong>Спасбросок · Сл {{ ctx.spellSaveDC(option.entry) }}</strong><small v-if="option.rule.save_condition">{{ option.rule.save_condition }}</small></template>
        <small v-if="option?.kind === 'damage' && instances > 1">Урон одного снаряда/луча. Всего: {{ instances }}.</small>
      </div>
    </template>
    <SpellCastControls :entry="entry" :cast-level="castLevel" :spend-by-default="spendByDefault" @preview="castPreview = $event" v-slot="cast">
      <template v-if="attack">
        <small v-if="hasSequence">После атаки выберите цель и продолжайте броски в хронике сессии.</small>
        <SpellDamageTypeChoice :entry="entry" :disabled="ctx.spellcastingBlocked" />
        <D20RollControls dialog scope="attack" :mode="attackMode.mode" :cancelled="attackMode.cancelled"
          :disabled="cast.disabled || !typeReady(entry)" :roll-label="cast.spend ? 'Бросить и потратить ячейку' : 'Бросить на атаку'"
          @preview="attackDraft = $event" @roll="(mode, excluded) => rollAttack(mode, cast, excluded)" />
      </template>
      <template v-else>
        <SpellDamageTypeChoice v-if="option.kind === 'damage'" :entry="option.entry" :disabled="ctx.spellcastingBlocked" />
        <FormField v-if="option.kind === 'damage' && option.rule.range_attack" label="Критическое попадание" title="Удваивает кости урона, но не постоянные прибавки.">
          <ToggleSwitch v-model="critical" surface="raised" aria-label="Критическое попадание" />
        </FormField>
        <ActionButton :disabled="cast.disabled || !optionReady" @click="roll(cast)">{{ cast.spend ? 'Бросить и потратить ячейку' : spellRollLabel(option) }}</ActionButton>
      </template>
    </SpellCastControls>
  </CharacterRollDialog>
</template>
<script setup>
import { computed, inject, ref, toRef } from 'vue'
import { ActionButton, FormField, ToggleSwitch } from '@sylvieshare/share-ui'
import CharacterRollDialog from '@/features/character-editor/components/CharacterRollDialog.vue'
import DamageFormulaPreview from './DamageFormulaPreview.vue'
import SpellDamageTypeChoice from './SpellDamageTypeChoice.vue'
import SpellCastControls from './SpellCastControls.vue'
import D20RollControls from './D20RollControls.vue'
import { useSpellRollOptions, spellRollLabel } from '../composables/useSpellRollOptions'
import { spellInstances } from '../lib/spellScaling'

const props = defineProps({ entry: { type: Object, required: true }, castLevel: { type: Number, required: true }, selection: { type: String, required: true } })
const emit = defineEmits(['close'])
const ctx = inject('spellsBlockCtx')
const { hasSequence, hasAttack, options } = useSpellRollOptions(toRef(props, 'entry'))
const attack = computed(() => props.selection === 'attack' && hasAttack.value)
const option = computed(() => options.value.find(option => option.key === props.selection))
const attackMode = computed(() => ctx.spellAttackMode(props.entry))
const attackDraft = ref({ mode: attackMode.value.cancelled ? 'normal' : attackMode.value.mode, excluded: [] })
const critical = ref(false), castPreview = ref({ castLevel: props.castLevel })
const typeReady = entry => ctx.spellDamageTypes?.ready(entry) !== false
const optionReady = computed(() => option.value?.kind !== 'damage' || typeReady(option.value.entry))
const spendByDefault = computed(() => attack.value || (option.value?.kind !== 'save' && !hasAttack.value && !option.value?.rule.range_attack))
const title = computed(() => `${props.entry.item?.name || 'Заклинание'} · ${attack.value ? 'Атака' : option.value?.label || 'Бросок'}`)
const instances = computed(() => option.value ? spellInstances(option.value.entry.item, castPreview.value.castLevel, ctx.charLevel) : 1)
const previewLabel = computed(() => attack.value ? 'Формула атаки' : option.value?.primary ? option.value.kind === 'damage' ? 'Итоговый урон' : option.value.rule.kind === 'temporary_hp' ? 'Временные хиты' : 'Итоговое лечение' : option.value?.label)
const previewColor = computed(() => attack.value ? attackDraft.value.mode === 'advantage' ? 'var(--success)' : attackDraft.value.mode === 'disadvantage' ? 'var(--danger)' : 'var(--accent-soft)'
  : option.value?.kind === 'heal' ? option.value.rule.kind === 'temporary_hp' ? 'var(--info)' : 'var(--success)' : 'var(--accent-soft)')
const expression = computed(() => {
  if (attack.value) return ['1d20', ctx.spellAttackBonus(props.entry), ctx.charCtx.characterDerivedEffects?.rollBonus?.({ kind: 'attack' }, attackDraft.value.excluded)]
    .filter(value => value).join('+').replace(/\+-/g, '-')
  const current = option.value
  if (!current || current.kind === 'save') return ''
  return current.kind === 'heal' ? ctx.spellHealPreview(current.entry, castPreview.value.castLevel)
    : ctx.spellDamagePreview(current.entry, castPreview.value.castLevel, current.kind === 'damage' && current.rule.range_attack && critical.value)
})
async function rollAttack(mode, cast, excluded) {
  if (ctx.spellcastingBlocked || !typeReady(props.entry) || !await cast.commit()) return
  ctx.rollSpellAttack(props.entry, mode, excluded, cast.castLevel)
  emit('close')
}
async function roll(cast) {
  if (ctx.spellcastingBlocked || !optionReady.value || !await cast.commit()) return
  const current = option.value
  if (current.kind === 'damage') ctx.rollSpellDamage(current.entry, cast.castLevel, current.rule.range_attack && critical.value)
  else if (current.kind === 'heal') ctx.rollSpellHeal(current.entry, cast.castLevel)
  else if (current.kind === 'save') await ctx.requestSpellSave(current.entry)
  else ctx.rollSpellEffect(current.entry, cast.castLevel)
  emit('close')
}
</script>
<style scoped>
.spell-roll-preview {display:grid;gap:var(--spacing-small);min-width:0}
.spell-roll-preview small {color:var(--text-muted);font-size:var(--type-context-size)}
</style>
