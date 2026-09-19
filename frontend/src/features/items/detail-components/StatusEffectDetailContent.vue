<template>
  <div class="status-effect-detail" :style="effectStyle">
    <DetailSection v-if="thesisLines.length" label="Кратко">
      <template #icon><ListChecks /></template>
      <div class="status-effect-theses">
        <div v-for="(line, index) in thesisLines" :key="index" class="status-effect-thesis">
          <span>{{ index + 1 }}</span>
          <strong>{{ line }}</strong>
        </div>
      </div>
    </DetailSection>

    <DetailSection v-if="data.desc" label="Описание">
      <template #icon><BookOpen /></template>
      <RichContent class="status-effect-description" :html="data.desc" :actor-name="actorName || item.name" />
    </DetailSection>

    <DetailSection v-if="mechanicRules.length || defenses.length" label="Механика" tone="danger">
      <template #icon><SlidersHorizontal /></template>
      <div class="status-effect-rules">
        <article v-for="(rule, index) in mechanicRules" :key="`rule-${index}`" class="status-effect-rule">
          <span>{{ rule.title }}</span>
          <strong>{{ rule.value }}</strong>
          <small v-if="rule.note">{{ rule.note }}</small>
        </article>
        <article v-for="(defense, index) in defenses" :key="`defense-${index}`" class="status-effect-rule status-effect-rule--defense">
          <span>{{ defense.kind }}</span>
          <strong>{{ defense.damageType }}</strong>
          <small>Пока эффект активен</small>
        </article>
      </div>
    </DetailSection>

    <DetailSection v-if="data.repeat_save || data.ongoing_damage || data.weapon_target || data.weapon_damage?.length" label="Действия эффекта">
      <div class="status-effect-rules">
        <article v-if="data.repeat_save" class="status-effect-rule">
          <span>Повторный спасбросок · {{ REPEAT_SAVE_TIMING[data.repeat_save.timing] || 'В конце хода' }}</span>
          <strong>{{ STAT_FULL[SUGGEST16_TO_STAT[data.repeat_save.ability]] }} · {{ data.repeat_save.dc ? `Сл ${data.repeat_save.dc}` : 'Сл источника при наложении' }}</strong>
          <small>Успех снимает этот эффект. {{ data.repeat_save.condition }}</small>
        </article>
        <article v-if="data.ongoing_damage" class="status-effect-rule">
          <span>Урон при употреблении и в начале хода</span>
          <DamageFormulaPreview :expression="`${data.ongoing_damage.dice_count}${data.ongoing_damage.dice}`" />
          <strong>Спасбросок: Сл {{ data.ongoing_damage.save_dc }}</strong>
          <small>Первый успех снимает эффект. Последующие успехи в конце хода уменьшают урон на {{ data.ongoing_damage.decrease_on_save || 1 }} кость.</small>
        </article>
        <article v-if="data.weapon_target" class="status-effect-rule"><span>Цель покрытия</span><strong>Одно выбранное оружие</strong><small>До выбора оружия бонусы не действуют. Выбор фиксируется на экземпляре эффекта.</small></article>
        <article v-for="rule in data.weapon_damage || []" :key="rule.key" class="status-effect-rule"><span>{{ rule.label || 'Урон оружия' }}</span><DamageFormulaPreview :expression="`${rule.sign === '-' ? '-' : ''}${rule.dice_count}${rule.dice}`" /><small>{{ rule.condition }}</small></article>
      </div>
    </DetailSection>
    <DetailSection v-if="data.on_end_effect?.id" label="После завершения"><HandbookReferenceRows :rows="[{ id: data.on_end_effect.id }]" :z-index="nestedViewZIndex" /></DetailSection>
    <EffectSources :sources="data.application_sources || []" :z-index="nestedViewZIndex" />

    <DetailSection v-if="exhaustionLevels.length" label="Уровни истощения" tone="danger">
      <template #icon><BatteryLow /></template>
      <ol class="status-effect-levels">
        <li v-for="entry in exhaustionLevels" :key="entry.level">
          <span>{{ entry.level }}</span>
          <div>
            <small>Уровень {{ entry.level }}</small>
            <strong>{{ entry.effect }}</strong>
          </div>
        </li>
      </ol>
    </DetailSection>
  </div>
</template>

<script setup>
import DamageFormulaPreview from '@/features/character-editor/blocks/dnd/components/DamageFormulaPreview.vue'
import { REPEAT_SAVE_TIMING } from '@/features/character-editor/lib/statusRepeatSave'
import { STAT_FULL, SUGGEST16_TO_STAT } from '@/shared/lib/dndStats'
import HandbookReferenceRows from '@/features/items/components/HandbookReferenceRows.vue'
import EffectSources from '@/features/items/components/EffectSources.vue'
import { computed, watch } from 'vue'
import { BatteryLow, BookOpen, ListChecks, SlidersHorizontal } from '@lucide/vue'
import { DEFAULT_EXHAUSTION_EFFECTS } from '@/features/character-editor/blocks/dnd/lib/exhaustion'
import {
  statusRulePresentation,
  statusThesisLines,
} from '@/features/items/lib/statusEffectPresentation'
import { useSuggestStore } from '@/stores/suggest'
import { DetailSection } from '@sylvieshare/share-ui'
import RichContent from '@/shared/ui/DndRichContent.vue'

const props = defineProps({
  item: { type: Object, required: true },
  actorName: { type: String, default: '' },
  nestedViewZIndex: { type: Number, default: 5100 },
})

const DEFENSE_LABELS = {
  resistance: 'Сопротивление',
  immunity: 'Невосприимчивость',
  vulnerability: 'Уязвимость',
}

const suggestStore = useSuggestStore()
const data = computed(() => props.item.data || {})
const thesisLines = computed(() => statusThesisLines(data.value.thesis))
const mechanicRules = computed(() => (Array.isArray(data.value.derived_effects) ? data.value.derived_effects : []).map(statusRulePresentation))
const defenseIds = computed(() => (Array.isArray(data.value.defenses) ? data.value.defenses : [])
  .map(rule => Number(rule?.damage_type))
  .filter(Number.isFinite))

watch(defenseIds, ids => suggestStore.ensureItems(12, ids), { immediate: true })

const defenses = computed(() => {
  const names = new Map(suggestStore.items(12).map(row => [Number(row.id), row.value]))
  return (Array.isArray(data.value.defenses) ? data.value.defenses : []).map(rule => ({
    kind: DEFENSE_LABELS[rule?.kind] || 'Защита',
    damageType: names.get(Number(rule?.damage_type)) || `Тип урона #${rule?.damage_type}`,
  }))
})
const exhaustionLevels = computed(() => {
  if (data.value.code !== 'exhaustion') return []
  const max = Math.min(DEFAULT_EXHAUSTION_EFFECTS.length, Math.max(0, Number(data.value.max_level) || 6))
  return DEFAULT_EXHAUSTION_EFFECTS.slice(0, max).map((effect, index) => ({ level: index + 1, effect }))
})
const effectStyle = computed(() => {
  const color = String(data.value.color || '').trim()
  return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(color) ? { '--effect-color': color } : {}
})
</script>

<style scoped>
.status-effect-detail { display: flex; flex-direction: column; gap: 2px; }
.status-effect-description { color: var(--text-1); font-size: 14px; line-height: 1.65; }

.status-effect-theses,
.status-effect-rules {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
}

.status-effect-thesis,
.status-effect-rule {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 13px 14px;
  border: 1px solid color-mix(in srgb, var(--effect-color, var(--accent)) 28%, var(--border));
  border-radius: 11px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--effect-color, var(--accent)) 9%, var(--surface)), var(--surface));
  box-shadow: inset 3px 0 0 color-mix(in srgb, var(--effect-color, var(--accent)) 66%, transparent);
}

.status-effect-thesis { flex-direction: row; align-items: flex-start; gap: 10px; }
.status-effect-thesis > span {
  width: 22px;
  height: 22px;
  flex: 0 0 22px;
  display: grid;
  place-items: center;
  border-radius: 7px;
  background: color-mix(in srgb, var(--effect-color, var(--accent)) 18%, transparent);
  color: var(--effect-color, var(--accent-soft));
  font-size: 10px;
  font-weight: 800;
}
.status-effect-thesis strong { color: var(--text-1); font-size: 13px; font-weight: 650; line-height: 1.45; }
.status-effect-rule > span { color: var(--text-muted); font-size: 9px; font-weight: 750; letter-spacing: .1em; text-transform: uppercase; }
.status-effect-rule > strong { color: var(--text-1); font-size: 16px; line-height: 1.25; }
.status-effect-rule > small { color: var(--text-2); font-size: 11px; line-height: 1.4; }
.status-effect-rule--defense { box-shadow: inset 3px 0 0 color-mix(in srgb, var(--info) 72%, transparent); }

.status-effect-levels {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.status-effect-levels li {
  min-width: 0;
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 11px;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
}
.status-effect-levels li > span {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: color-mix(in srgb, var(--danger) 15%, transparent);
  color: var(--danger);
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 700;
}
.status-effect-levels li > div { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.status-effect-levels small { color: var(--text-muted); font-size: 8px; font-weight: 750; letter-spacing: .1em; text-transform: uppercase; }
.status-effect-levels strong { color: var(--text-1); font-size: 12px; line-height: 1.4; }

@media (max-width: 660px) {
  .status-effect-theses,
  .status-effect-rules,
  .status-effect-levels { grid-template-columns: 1fr; }
}
</style>
