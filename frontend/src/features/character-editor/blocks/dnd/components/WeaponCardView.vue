<template>
  <!-- Shared weapon row, rendered both in the list tile and inside the morph #view, so the geometry
       can never drift between the two. Values open their corresponding roll settings. -->
  <WeaponCardLayout class="w-card-main">
    <template v-if="weaponItem?.iconImageUrl || weaponItem?.svg || weaponItem?.svgId || weaponItem?.iconSvgId" #icon>
    <ItemIcon
      class="w-icon"
      :item="weaponItem"
      :size="layoutTokens['weapon-card-icon']"
      :fallback-to-type="false"
    />
    </template>
    <template #heading>
      <div class="w-card-title">
        <div class="w-name-main">
          <span
            class="w-name"
          >{{ ctx.itemTitle(entry) }}</span>
          <span v-if="ctx.magicBonus(entry) > 0" class="w-name-magic">+{{ ctx.magicBonus(entry) }}</span>
        </div>
        <span v-if="ctx.rangeLabel(entry)" class="w-range">{{ ctx.rangeLabel(entry) }}</span>
        <span v-else-if="ctx.itemSubtitle(entry)" class="w-subtitle">{{ ctx.itemSubtitle(entry) }}</span>
        <WeaponAttunementStatus :entry="entry" :item="ctx.itemMap?.[entry.magic_item_id]" />
        <span v-if="ctx.isWeaponProficient(entry)" class="w-proficiency">Владение</span>
      </div>
    </template>
    <template v-if="weaponItem || (!entry.item_id && !entry.magic_item_id)" #controls>
      <WeaponMetricsTable class="w-card-controls"
        :attack="ctx.formatBonus(attackSummary.bonus)" :attack-rows="attackRows" :attack-color="attackColor" :damage-rows="damageRows" :two-handed-rows="twoHandedRows"
        :alternative-damage="alternativeDamage" :damage-key="damageKey"
        :damage-type="String(primaryDamage?.type || '')" :damage-color="primaryDamage?.typeColor"
        :properties="ctx.propertyItems(entry)" :interactive="interactive" :roll-scope="rollScope"
        :can-attack="!!ctx.charCtx.ownerMode && !!weaponItem" :can-damage="!!ctx.charCtx.ownerMode && (!!weaponItem || !!ctx.hasWeaponDamage?.(entry))"
        @roll="(scope, event, selection) => emit('roll', scope, event, selection)"
        @property-enter="(event, property) => ctx.showPropertyTooltip(event, property)"
        @property-leave="ctx.hidePropertyTooltip()"
      >
        <slot />
      </WeaponMetricsTable>
    </template>
  </WeaponCardLayout>
</template>

<script setup>
import WeaponAttunementStatus from './WeaponAttunementStatus.vue'
import { computed, inject } from 'vue'
import WeaponMetricsTable from './WeaponMetricsTable.vue'
import { useWeaponCardPreview } from '../composables/useWeaponCardPreview'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import WeaponCardLayout from './WeaponCardLayout.vue'
import { layoutTokens } from '@/app/design-tokens'

const props = defineProps({
  entry: { type: Object, required: true },
  // tile = full interactivity; morph clone = static
  interactive: { type: Boolean, default: false },
  rollScope: String,
  damageKey: String,
  rollPreview: Object,
})
const emit = defineEmits(['roll'])

const ctx = inject('weaponsBlockCtx')

// The linked handbook weapon may use either a stored image or an SVG icon.
const weaponItem = computed(() => ctx.item(props.entry))
const primaryDamage = computed(() => ctx.damagePartsRaw(props.entry)[0])
const { attackSummary, attackRows, attackColor, damageRows, twoHandedRows, alternativeDamage }
  = useWeaponCardPreview(ctx, () => props.entry, () => props.rollPreview)
</script>

<style scoped>

.w-card-title {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.w-name-main {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  min-width: 0;
}

.w-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
  white-space: normal;
  overflow: hidden;
  text-overflow: ellipsis;
}

.w-name-magic {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent-soft);
  flex-shrink: 0;
}

.w-range, .w-subtitle {
  font-size: 11px;
  color: var(--text-muted);
  white-space: normal;
  overflow: hidden;
  text-overflow: ellipsis;
}

.w-proficiency {
  color: var(--success);
  font-size: 10px;
  font-weight: 700;
}

</style>
