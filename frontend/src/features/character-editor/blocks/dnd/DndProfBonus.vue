<template>
  <StatTile ref="tile" editor-title="Бонус владения" :editor-only="block.props?.editorOnly"
    :variant="variant"
    :embedded="block.props?.embedded"
    label="Мастерство"
    :mini-label="block.title || 'Бонус'"
    :value="displayValue"
    pre="+"
    :icon="iconSrc"
    rollable
    @action="rollProf"
  >
    <!-- compact / default (mobile) look: tap the value to roll, the pencil to edit -->
    <template #tile="{ open, action, canEdit, attrs }">
      <MorphTile :outlined="false" v-bind="attrs" compact-header :title="block.title || 'Мастерство'" :show-edit="canEdit" edit-label="Редактировать" @edit="open" class="skill-bonus-tile" :class="{ 'skill-bonus-tile-compact': variant === 'compact' }">
        <div class="sb-display" @click="action">
          <span class="sb-plus">+</span>
          <span class="sb-value" :class="{ 'sb-manual': stored.auto === false }">{{ displayValue }}</span>
          <img v-if="block.content?.svg" class="sb-svg" :src="block.content.svg" alt="" aria-hidden="true" />
        </div>
      </MorphTile>
    </template>

    <template #editor>
      <EditorPanel>
        <EditorSection title="Значение">
          <ToggleSwitch
            :modelValue="stored.auto !== false"
            :label="`Считать автоматически (= ${autoValue})`"
            @update:modelValue="setAuto"
          />
          <FormField v-if="stored.auto === false" label="Значение">
            <FormNumberInput live :value="stored.v" :min="0" :max="20" @change="setV" />
          </FormField>
        </EditorSection>
        <EditorSection title="Бонусы">
          <BonusList :bonuses="stored.bonuses" @update:bonuses="setBonuses" />
        </EditorSection>
      </EditorPanel>
    </template>
  </StatTile>
</template>

<script setup>
import { MorphTile } from '@sylvieshare/share-ui'
import { computed, inject, ref, watch } from 'vue'
import { d20Expr } from '@/shared/lib/dnd'
import { proficiencySummary } from '@/features/character-editor/lib/utilityValues'
import BonusList from '@/shared/ui/BonusList'
import { EditorPanel } from '@sylvieshare/share-ui'
import { EditorSection } from '@sylvieshare/share-ui'
import { FormField } from '@sylvieshare/share-ui'
import { FormNumberInput } from '@sylvieshare/share-ui'
import StatTile from '@/features/character-editor/blocks/dnd/components/StatTile'
import { ToggleSwitch } from '@sylvieshare/share-ui'
import { useDiceStore } from '@/stores/dice'

const props = defineProps(['block', 'values', 'value'])
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', { ownerMode: false })
const tile = ref(null)
defineExpose({ open: () => tile.value?.open(), action: () => rollProf() })

const diceStore = useDiceStore()

const variant = computed(() => props.block.props?.variant || props.block.content?.variant || '')
const iconSrc = computed(() => props.block?.content?.svg || null)

const summary = computed(() => proficiencySummary(props.value, props.values?.[props.block.content.level_id]?.level))
const autoValue = computed(() => summary.value.autoValue)
const stored = computed(() => summary.value.stored)
const displayValue = computed(() => summary.value.total)

watch(autoValue, newVal => {
  if (charCtx.ownerMode && stored.value.auto !== false && props.value?.v !== newVal) {
    emit('update:value', props.block.id, { ...stored.value, v: newVal, auto: true })
  }
})

function setAuto(checked) {
  emit('update:value', props.block.id, {
    ...stored.value,
    auto: checked,
    v: checked ? autoValue.value : (stored.value.v ?? autoValue.value),
  })
}
function setV(v) { emit('update:value', props.block.id, { ...stored.value, v, auto: false }) }
function setBonuses(bonuses) { emit('update:value', props.block.id, { ...stored.value, bonuses }) }

function rollProf() {
  diceStore.roll(props.block.title || 'Бонус мастерства', d20Expr(displayValue.value), { crit_mode: true })
}
</script>

<style scoped>
/* ── Compact / default variant ── */
.skill-bonus-tile {
  position: relative;
  width: 100px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.sb-display { cursor: pointer; }
.skill-bonus-tile-compact { width: 76px; min-width: 76px; gap: 2px; }
.skill-bonus-tile-compact .sb-plus { font-size: 18px; }
.skill-bonus-tile-compact .sb-value { font-size: 22px; min-width: 16px; }
.skill-bonus-tile-compact .sb-svg { width: 17px; height: 17px; }

.sb-display { display: flex; align-items: center; gap: 4px; }
.sb-plus { color: var(--text-2); font-size: 24px; font-weight: bold; line-height: 1; }
.sb-value { color: var(--text-2); font-size: 28px; font-weight: bold; text-align: center; min-width: 20px; transition: color 0.2s ease; }
.sb-value.sb-manual { color: var(--text-1); }
.sb-svg { width: 20px; height: 20px; flex-shrink: 0; opacity: 0.8; }
</style>
