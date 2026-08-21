<template>
  <!-- Shared weapon row, rendered both in the list tile and inside the morph #view, so the geometry
       can never drift between the two. `interactive` is true in the tile (name handlers, pencil button,
       rollable attack/damage, property tooltips) and false in the morph clone (plain text + ghost pencil
       that fades as the window opens). -->
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
            :class="{ 'w-name-clickable': interactive && nameClickable, 'w-name-drag': interactive && ctx.charCtx.ownerMode }"
            @pointerdown="interactive && emit('name-down', $event)"
            @click="interactive && emit('name-click')"
          >{{ ctx.itemTitle(entry) }}</span>
          <span v-if="ctx.magicBonus(entry) > 0" class="w-name-magic">+{{ ctx.magicBonus(entry) }}</span>
          <template v-if="ctx.charCtx.ownerMode">
            <button
              v-if="interactive"
              class="w-edit-btn"
              type="button"
              title="Редактировать"
              @click.stop="emit('edit')"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </button>
            <span
              v-else
              class="w-edit-btn w-edit-btn--ghost"
              :class="{ 'w-edit-btn--hidden': revealed }"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </span>
          </template>
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
        :rollable="interactive"
        @roll-attack="emit('roll-attack')"
        @roll-damage="emit('roll-damage')"
        @roll-damage-two="emit('roll-damage-two')"
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
  // tile = full interactivity; morph clone = static (revealed fades the ghost pencil out)
  interactive: { type: Boolean, default: false },
  revealed: { type: Boolean, default: false },
})
const emit = defineEmits(['name-down', 'name-click', 'edit', 'roll-attack', 'roll-damage', 'roll-damage-two'])

const ctx = inject('weaponsBlockCtx')

// The linked handbook weapon may use either a stored image or an SVG icon.
const weaponItem = computed(() => ctx.item(props.entry))
// owner: name opens the edit morph; non-owner: name opens the read-only item card (if linked)
const nameClickable = computed(() => ctx.charCtx.ownerMode || !!ctx.item(props.entry))
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
.w-name-clickable { cursor: pointer; transition: color 0.12s; }
.w-name-clickable:hover { color: var(--accent); }
/* name doubles as the reorder handle for owners */
.w-name-drag { cursor: grab; touch-action: none; }
.w-name-drag:active { cursor: grabbing; }

.w-name-magic {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent-soft);
  flex-shrink: 0;
}

.w-edit-btn {
  display: inline-grid;
  place-items: center;
  width: 20px;
  height: 20px;
  padding: 0;
  box-sizing: border-box;
  flex-shrink: 0;
  align-self: center;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0.35;
  transition: color 0.15s, opacity 0.2s ease;
}
@media (hover: hover) { .w-edit-btn:hover { color: var(--accent); opacity: 1; } }
.w-edit-btn:focus-visible { color: var(--accent); opacity: 1; }

/* morph stand-in pencil: present so the row geometry matches the tile (no jitter), but fades out
   as the window opens and back in as it closes */
.w-edit-btn--ghost { pointer-events: none; }
.w-edit-btn--hidden { opacity: 0; }

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
