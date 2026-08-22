<template>
  <!-- Shared weapon row, rendered both in the list tile and inside the morph #view, so the geometry
       can never drift between the two. Weapon values are display-only; rolls live in the card menu. -->
  <div class="w-card-main">
    <ItemIcon
      v-if="weaponItem?.iconImageUrl || weaponItem?.svg"
      class="w-icon"
      :item="weaponItem"
      :size="64"
      :fallback-to-type="false"
    />
    <div class="w-card-view">
      <div class="w-card-title">
        <div class="w-name-main">
          <span
            class="w-name"
            :class="{ 'w-name-drag': interactive && ctx.charCtx.ownerMode }"
            @pointerdown="interactive && emit('name-down', $event)"
          >{{ ctx.itemTitle(entry) }}</span>
          <span v-if="ctx.magicBonus(entry) > 0" class="w-name-magic">+{{ ctx.magicBonus(entry) }}</span>
        </div>
        <span v-if="ctx.rangeLabel(entry)" class="w-range">{{ ctx.rangeLabel(entry) }}</span>
        <span v-else-if="ctx.itemSubtitle(entry)" class="w-subtitle">{{ ctx.itemSubtitle(entry) }}</span>
        <span v-if="ctx.isWeaponProficient(entry)" class="w-proficiency">Владение</span>
      </div>
      <AttackDamage
        :attack="ctx.formatBonus(ctx.attackBonus(entry))"
        :damage-parts="ctx.damagePartsRaw(entry)"
        :modifier="ctx.damageBonus(entry)"
        :two-handed-parts="ctx.twoHandedParts(entry)"
      />
      <div class="w-props-inline">
        <span
          v-for="(property, propertyIndex) in ctx.propertyItems(entry)"
          :key="property.id ?? propertyIndex"
          class="w-prop sheet-tag-chip"
          :class="{ 'sheet-tag-has-desc': interactive && property.desc }"
          @mouseenter="interactive && ctx.showPropertyTooltip($event, property)"
          @mouseleave="interactive && ctx.hidePropertyTooltip()"
        >{{ property.label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import AttackDamage from '@/features/character-editor/blocks/dnd/components/AttackDamage.vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'

const props = defineProps({
  entry: { type: Object, required: true },
  // tile = full interactivity; morph clone = static
  interactive: { type: Boolean, default: false },
})
const emit = defineEmits(['name-down'])

const ctx = inject('weaponsBlockCtx')

// The linked handbook weapon may use either a stored image or an SVG icon.
const weaponItem = computed(() => ctx.item(props.entry))
</script>

<style scoped>
/* icon column (flush left, fixed-size square, vertically centred) + the padded content grid */
.w-card-main { display: flex; align-items: stretch; gap: 0; min-width: 0; }
.w-icon {
  flex: 0 0 64px;
  align-self: center;
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-2);
  overflow: hidden;
}
.w-card-view {
  flex: 1 1 auto;
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, auto) minmax(0, 1.5fr);
  align-items: center;
  gap: 14px;
  min-width: 0;
  padding: 14px 20px 14px 16px;
}

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
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* The name remains the reorder handle for owners; a click is handled by the card action menu. */
.w-name-drag { cursor: grab; touch-action: none; }
.w-name-drag:active { cursor: grabbing; }

.w-name-magic {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent-soft);
  flex-shrink: 0;
}

.w-range, .w-subtitle {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.w-proficiency {
  color: var(--success);
  font-size: 10px;
  font-weight: 700;
}

.w-props-inline {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
}

.w-prop { font-size: 11px; padding: 2px 8px; }

@media (max-width: 760px) {
  .w-card-view {
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
    gap: 10px;
  }

  .w-name { font-size: 15px; }
  .w-range { margin-top: 4px; white-space: normal; }
}
</style>
