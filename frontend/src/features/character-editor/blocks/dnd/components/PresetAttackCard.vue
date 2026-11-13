<template>
  <BaseTile :outlined="false" class="pac-card">
    <WeaponCardLayout>
      <template #icon>
      <ItemIcon
        class="pac-icon"
        :item="iconItem"
        :size="layoutTokens['weapon-card-icon']"
        :fallback-to-type="false"
        :placeholder="!iconItem"
      />
      </template>
      <template #heading>
        <div class="pac-title">
          <strong>{{ title }}</strong>
          <small>{{ subtitle }}</small>
          <span v-if="proficient" class="pac-proficiency">Владение</span>
        </div>
      </template>
      <template #controls>
        <WeaponMetricsTable :attack="formatBonus(attackBonus)" :attack-rows="attackRows" :attack-color="attackColor" :damage-rows="damageRows"
          :damage-type="damageType" interactive :roll-scope="selection?.scope"
          @roll="openMenu" />
      </template>
    </WeaponCardLayout>
  </BaseTile>
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
import { BasePopover, BaseTile } from '@sylvieshare/share-ui'
import { layoutTokens } from '@/app/design-tokens'
import WeaponCardLayout from './WeaponCardLayout.vue'
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
  cursor: default;
}
.pac-title { display: flex; min-width: 0; flex-direction: column; gap: 1px; }
.pac-title strong { overflow-wrap:anywhere; color: var(--text-1); font-size: 15px; font-weight: 600; }
.pac-title small { color: var(--text-muted); font-size: 11px; }
.pac-proficiency { color: var(--success); font-size: 10px; font-weight: 700; }

</style>
