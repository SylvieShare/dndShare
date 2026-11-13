<template>
  <article class="pac-card">
    <div class="pac-main">
      <ItemIcon
        class="pac-icon"
        :item="iconItem"
        :size="64"
        :fallback-to-type="false"
        :placeholder="!iconItem"
      />
      <div class="pac-view">
        <div class="pac-title">
          <strong>{{ title }}</strong>
          <small>{{ subtitle }}</small>
          <span v-if="proficient" class="pac-proficiency">Владение</span>
        </div>
        <WeaponMetricsTable :attack="formatBonus(attackBonus)" :attack-rows="attackRows" :attack-color="attackColor" :damage-rows="damageRows"
          :damage-type="damageType" interactive :roll-scope="selection?.scope"
          @roll="openMenu" />
      </div>
    </div>
  </article>
  <BasePopover v-if="selection" :open="true" :anchor="selection.anchor" :key="selection.scope"
    :aria-label="selection.scope === 'attack' ? 'Атака' : 'Урон'" role="menu" :z-index="4100" transition-preset="action-menu"
    @update:open="!$event && closeMenu()">
    <WeaponRollSettings :scope="selection.scope" :weapon-title="title" :weapon="iconItem" :summary="summary"
      @preview="preview = $event"
      @attack="options => run('attack', options)"
      @roll="options => run(options.critical ? 'critical' : 'damage', options)" />
  </BasePopover>
</template>

<script setup>
import { computed, inject, shallowRef } from 'vue'
import { weaponAttackColor, weaponAttackFormula } from '../lib/weaponAttackFormula'
import { BasePopover } from '@sylvieshare/share-ui'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import WeaponRollSettings from './WeaponRollSettings.vue'
import WeaponMetricsTable from './WeaponMetricsTable.vue'

const props = defineProps({
  title: { type: String, required: true },
  summary: { type: Function, required: true },
  subtitle: { type: String, default: '' },
  attackBonus: { type: Number, required: true },
  damageType: { type: String, default: 'Дробящий' },
  iconItem: { type: Object, default: null },
  proficient: { type: Boolean, default: false },
})

const emit = defineEmits(['attack', 'damage', 'critical'])
const charCtx = inject('charCtx', {})
const preview = shallowRef(null)
const options = computed(() => preview.value?.options || {})
const attackSummary = computed(() => props.summary(options.value, 'attack'))
const attackColor = computed(() => weaponAttackColor(attackSummary.value.mode))
const attackRows = computed(() => weaponAttackFormula(attackSummary.value,
  charCtx.characterDerivedEffects?.rollBonusOptions?.({ kind: 'attack' }) || [], options.value.excludedBonuses || []))
const damageRows = computed(() => props.summary(options.value, 'damage').parts)

const selection = shallowRef(null)
function openMenu(scope, event) {
  const anchor = event.currentTarget
  if (selection.value?.anchor === anchor) closeMenu()
  else { preview.value = null; selection.value = { scope, anchor } }
}
function closeMenu() { selection.value = null; preview.value = null }
function run(action, options) {
  closeMenu()
  emit(action, options)
}

function formatBonus(value) {
  const bonus = Number(value) || 0
  return bonus >= 0 ? `+${bonus}` : String(bonus)
}

</script>

<style scoped>
.pac-card {
  position: relative;
  box-sizing: border-box;
  overflow: clip;
  cursor: pointer;
}
.pac-main { display: flex; align-items: stretch; min-width: 0; min-height: 86px; }
.pac-icon { display: flex; flex: 0 0 64px; align-self: center; align-items: center; justify-content: center; width: 64px; height: 64px; overflow: hidden; }
.pac-view {
  display: grid;
  flex: 1 1 auto;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  min-width: 0;
  padding: 14px 20px 14px 16px;
}
.pac-title { display: flex; min-width: 0; flex-direction: column; gap: 1px; }
.pac-title strong { overflow: hidden; color: var(--text-1); font-size: 14px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.pac-title small { overflow: hidden; color: var(--text-muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.pac-proficiency { color: var(--success); font-size: 10px; font-weight: 700; }

@media (--ui-compact) {
  .pac-view { grid-template-columns: minmax(0, 1fr); align-items: start; gap: 10px; }
  .pac-title strong { font-size: 15px; }
  .pac-title small { white-space: normal; }
}
</style>
