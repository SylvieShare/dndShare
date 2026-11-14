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
  <CharacterRollDialog v-if="selection" :key="selection.scope" :title="`${title} · ${selection.scope === 'attack' ? 'Атака' : 'Урон'}`" @close="closeMenu">
    <template #preview><WeaponRollPreview :scope="selection.scope" :attack-bonus="previewAttackSummary.bonus" :attack-rows="previewAttackRows" :attack-color="previewAttackColor" :damage-rows="previewDamageRows" :damage-type="damageType" /></template>
    <WeaponRollSettings dialog :scope="selection.scope" :weapon-title="title" :weapon="iconItem" :summary="summary"
      @preview="preview = $event"
      @attack="options => run('attack', options)"
      @roll="options => run(options.critical ? 'critical' : 'damage', options)" />
  </CharacterRollDialog>
</template>

<script setup>
import { computed, inject, shallowRef } from 'vue'
import { weaponAttackColor, weaponAttackFormula } from '../lib/weaponAttackFormula'
import { BaseTile } from '@sylvieshare/share-ui'
import { layoutTokens } from '@/app/design-tokens'
import WeaponCardLayout from './WeaponCardLayout.vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import WeaponRollSettings from './WeaponRollSettings.vue'
import WeaponMetricsTable from './WeaponMetricsTable.vue'
import CharacterRollDialog from '@/features/character-editor/components/CharacterRollDialog.vue'
import WeaponRollPreview from './WeaponRollPreview.vue'

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
const attackSummary = computed(() => props.summary({}, 'attack'))
const attackColor = computed(() => weaponAttackColor(attackSummary.value.mode))
const attackRows = computed(() => weaponAttackFormula(attackSummary.value,
  charCtx.characterDerivedEffects?.rollBonusOptions?.({ kind: 'attack' }) || [], []))
const damageRows = computed(() => props.summary({}, 'damage').parts)
const previewOptions = computed(() => preview.value?.options || {})
const previewAttackSummary = computed(() => props.summary(previewOptions.value, 'attack'))
const previewAttackColor = computed(() => weaponAttackColor(previewAttackSummary.value.mode))
const previewAttackRows = computed(() => weaponAttackFormula(previewAttackSummary.value,
  charCtx.characterDerivedEffects?.rollBonusOptions?.({ kind: 'attack' }) || [], previewOptions.value.excludedBonuses || []))
const previewDamageRows = computed(() => props.summary(previewOptions.value, 'damage').parts)

const selection = shallowRef(null)
function openMenu(scope) {
  preview.value = { scope, options: {} }
  selection.value = { scope }
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
