<template>
  <tr
    class="w-row"
    :class="{
      'w-row-with-desc': entry.desc || ctx.activeNoteKey === entry._key,
      'w-row-hovered': hovered,
      'sortable-placeholder': ctx.sortable.isSource(entry),
    }"
    :data-sortable-key="entry._key"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
  >
    <td v-if="ctx.charCtx.ownerMode" class="w-order">
      <span class="drag-handle w-order-handle" @pointerdown="ctx.onDragStart($event, entry, index)">
        <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor">
          <circle cx="2" cy="2" r="1"/><circle cx="6" cy="2" r="1"/>
          <circle cx="2" cy="7" r="1"/><circle cx="6" cy="7" r="1"/>
          <circle cx="2" cy="12" r="1"/><circle cx="6" cy="12" r="1"/>
        </svg>
      </span>
    </td>

    <td class="w-name-cell">
      <div class="w-name-line">
        <div class="w-name-main">
          <span class="w-name">{{ ctx.itemTitle(entry) }}</span>
          <span v-if="ctx.rangeLabel(entry)" class="w-range">({{ ctx.rangeLabel(entry) }})</span>
          <span v-if="ctx.magicBonus(entry) > 0" class="w-name-magic">+{{ ctx.magicBonus(entry) }}</span>
        </div>
        <div class="w-name-actions">
          <button
            v-if="ctx.charCtx.ownerMode"
            class="w-note-btn"
            type="button"
            :class="{ 'w-note-btn-filled': entry.desc }"
            title="Редактировать заметку"
            @click="ctx.toggleNote(entry._key)"
          >
            <svg class="w-note-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 4.5h8.25M5 9h6.25M5 13.5h4.25" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
              <path d="M14.15 18.35 19.7 12.8a1.65 1.65 0 0 0 0-2.33l-.17-.17a1.65 1.65 0 0 0-2.33 0l-5.55 5.55-.65 3.15 3.15-.65Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
              <path d="m16.35 11.15 2.5 2.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
            </svg>
          </button>
          <button
            v-if="ctx.item(entry)"
            class="w-info-btn"
            type="button"
            title="Подробнее"
            @click="ctx.openItemModal(entry.item_id)"
          >?</button>
        </div>
      </div>
      <span v-if="ctx.itemSubtitle(entry)" class="w-subtitle">{{ ctx.itemSubtitle(entry) }}</span>
    </td>

    <td v-if="ctx.charCtx.ownerMode" class="w-stat-controls">
      <ValueSelect
        class="w-stat-select"
        :model-value="entry.stat_suggest_id"
        :options="ctx.statOptions"
        placeholder="Выберите стату"
        searchable
        search-placeholder="Поиск статы..."
        @update:model-value="ctx.setField(index, 'stat_suggest_id', $event)"
      />
      <button
        class="w-prof"
        :class="{ on: entry.proficient }"
        type="button"
        @click="ctx.setField(index, 'proficient', !entry.proficient)"
      >
        Владение
      </button>
    </td>

    <td v-if="ctx.charCtx.ownerMode">
      <ValueSelect
        class="w-magic-select"
        :model-value="entry.magic_up ?? 0"
        :options="ctx.magicOptions"
        placeholder="0"
        @update:model-value="ctx.setField(index, 'magic_up', Number($event) || 0)"
      />
    </td>

    <td v-if="!ctx.charCtx.ownerMode" class="w-attack-cell">
      <span
        class="w-attack w-attack-clickable"
        title="Бросить атаку"
        @click="ctx.rollAttack(entry)"
      >{{ ctx.formatBonus(ctx.attackBonus(entry)) }}</span>
    </td>

    <td class="w-damage">
      <template v-if="ctx.charCtx.ownerMode">
        <div v-for="(attack, attackIndex) in (entry.add_attacks || [])" :key="attackIndex" class="w-extra-row">
          <input
            class="w-count"
            :value="attack.count"
            type="number"
            min="1"
            @input="ctx.setAttackField(index, attackIndex, 'count', Number($event.target.value) || 1)"
          />
          <ValueSelect
            class="w-dice"
            :model-value="attack.dice_id"
            :options="ctx.diceOptions"
            placeholder="Куб"
            searchable
            search-placeholder="Куб..."
            @update:model-value="ctx.setAttackField(index, attackIndex, 'dice_id', $event)"
          />
          <ValueSelect
            class="w-type"
            :model-value="attack.type_suggest_id"
            :options="ctx.damageTypeOptions"
            placeholder="Тип"
            searchable
            search-placeholder="Тип..."
            @update:model-value="ctx.setAttackField(index, attackIndex, 'type_suggest_id', $event)"
          />
          <button class="w-mini-btn" type="button" title="Удалить" @click="ctx.removeAttack(index, attackIndex)">
            <span class="w-cross" aria-hidden="true"></span>
          </button>
        </div>
        <div class="w-damage-actions">
          <button class="w-add-damage" type="button" @click="ctx.addAttack(index)">+ доп. урон</button>
        </div>
      </template>
      <span
        v-else
        class="w-damage-view"
        :class="{ 'w-damage-view-clickable': ctx.damageParts(entry).length }"
        :title="ctx.damageParts(entry).length ? 'Бросить урон' : null"
        @click="ctx.rollDamage(entry)"
      >
        <template v-for="(part, partIndex) in ctx.damageParts(entry)" :key="partIndex">
          <span v-if="partIndex > 0" class="w-damage-comma">,</span>
          <span class="w-damage-part">
            <span v-if="part.modifier" class="w-damage-mod">{{ part.modifier }} +</span>
            <template v-if="part.diceSides">
              <span v-if="part.count !== 1" class="w-damage-count">{{ part.count }}</span>
              <SystemDie :sides="part.diceSides" :size="30" :color="part.typeColor" />
            </template>
            <template v-else>{{ part.label }}</template>
            <span v-if="part.type" class="w-damage-type">{{ part.type }}</span>
          </span>
        </template>
      </span>
    </td>

    <td v-if="ctx.charCtx.ownerMode" class="w-delete-cell">
      <button class="w-delete" type="button" title="Удалить оружие" @click="ctx.deleteWeapon(index)">
        <span class="w-cross" aria-hidden="true"></span>
      </button>
    </td>

    <td v-if="!ctx.charCtx.ownerMode" class="w-props-text">
      <template v-if="ctx.propertyItems(entry).length">
        <template v-for="(property, propertyIndex) in ctx.propertyItems(entry)" :key="property.id ?? propertyIndex">
          <span v-if="propertyIndex > 0" class="w-props-sep">, </span>
          <span
            class="w-prop"
            :class="{ 'w-prop-has-desc': property.desc }"
            @mouseenter="ctx.showPropertyTooltip($event, property)"
            @mouseleave="ctx.hidePropertyTooltip"
          >{{ property.label }}</span>
        </template>
      </template>
      <span v-else>—</span>
    </td>
  </tr>

  <tr
    v-if="ctx.charCtx.ownerMode && (entry.desc || ctx.activeNoteKey === entry._key)"
    class="w-desc-row"
    :class="{ 'w-row-hovered': hovered }"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
  >
    <td :colspan="colspan">
      <RichContent v-if="entry.desc && ctx.activeNoteKey !== entry._key" class="w-desc-text" :html="entry.desc" />
      <div v-if="ctx.activeNoteKey === entry._key" class="w-note-editor-row">
        <InputDescription
          class="w-note-editor"
          editable
          :block="{ id: 'desc', content: { placeholder: 'Заметки...' } }"
          :value="entry.desc || ''"
          @update:value="(_, value) => ctx.setField(index, 'desc', value)"
        />
      </div>
    </td>
  </tr>
  <tr
    v-else-if="!ctx.charCtx.ownerMode && entry.desc"
    class="w-desc-row"
    :class="{ 'w-row-hovered': hovered }"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
  >
    <td :colspan="colspan">
      <RichContent class="w-desc-text" :html="entry.desc" />
    </td>
  </tr>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import InputDescription from '@/shared/ui/InputDescription'
import { RichContent } from '@sylvieshare/share-ui'
import SystemDie from '@/shared/ui/SystemDie.vue'
import { ValueSelect } from '@sylvieshare/share-ui'

defineProps({
  entry: { type: Object, required: true },
  index: { type: Number, required: true },
})

const ctx = inject('weaponsBlockCtx')
const hovered = ref(false)
const colspan = computed(() => ctx.charCtx.ownerMode ? 6 : 4)
</script>

<style scoped>
.w-row {
  transition: background 0.12s;
}
.w-row.w-row-hovered td { background: color-mix(in srgb, var(--text-on-accent) 4%, transparent); }
.w-row-with-desc td { border-bottom: 0; }

.w-row.sortable-placeholder td {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  border-top: 2px dashed color-mix(in srgb, var(--accent) 50%, transparent);
  border-bottom: 2px dashed color-mix(in srgb, var(--accent) 50%, transparent);
}
.w-row.sortable-placeholder td > * { visibility: hidden; }

.w-order {
  padding: 8px 6px;
}
.drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  cursor: grab;
}
.drag-handle:hover { color: var(--text-2); }
.drag-handle:active { cursor: grabbing; }
.w-order-handle { padding: 4px 0; }

.w-name-cell {
  padding: 8px 10px;
  min-width: 0;
}

.w-name-line {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

.w-name-main {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  min-width: 0;
  flex: 1;
}

.w-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.w-name-magic {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent-soft);
  flex-shrink: 0;
}

.w-range {
  font-size: 11px;
  color: var(--text-muted);
}

.w-subtitle {
  display: block;
  margin-top: 1px;
  font-size: 11px;
  color: var(--text-muted);
}

.w-name-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.w-note-btn, .w-info-btn, .w-mini-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  background: color-mix(in srgb, var(--text-on-accent) 4%, transparent);
  border: 1px solid color-mix(in srgb, var(--text-on-accent) 8%, transparent);
  border-radius: 6px;
  color: var(--text-muted);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  transition: color 0.15s, background 0.12s, border-color 0.12s;
}
.w-note-btn:hover, .w-info-btn:hover, .w-mini-btn:hover {
  color: var(--text-1);
  border-color: color-mix(in srgb, var(--text-on-accent) 14%, transparent);
}
.w-note-btn-filled { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 40%, transparent); }
.w-note-icon { width: 13px; height: 13px; }

.w-stat-controls {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 8px;
}

.w-prof {
  font-size: 11px;
  font-weight: 700;
  padding: 5px 8px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--text-on-accent) 4%, transparent);
  border: 1px solid color-mix(in srgb, var(--text-on-accent) 8%, transparent);
  color: var(--text-muted);
  cursor: pointer;
  font-family: inherit;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.w-prof.on {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  color: var(--accent);
}

.w-attack-cell {
  text-align: center;
  padding: 8px;
}

.w-attack {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  height: 28px;
  padding: 0 8px;
  background: color-mix(in srgb, var(--text-on-accent) 5%, transparent);
  border: 1px solid color-mix(in srgb, var(--text-on-accent) 8%, transparent);
  border-radius: 7px;
  font-size: 13px;
  font-weight: 700;
  color: var(--accent-soft);
}
.w-attack-clickable { cursor: pointer; transition: background 0.12s, border-color 0.12s; }
.w-attack-clickable:hover {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
}

.w-damage {
  padding: 6px 10px;
}

.w-damage-view {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 6px;
  font-size: 13px;
  color: var(--text-1);
}
.w-damage-view-clickable {
  cursor: pointer;
  padding: 3px 6px;
  margin: -3px -6px;
  border-radius: 6px;
  transition: background 0.12s;
}
.w-damage-view-clickable:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); }

.w-damage-part {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.w-damage-comma { color: var(--text-muted); }
.w-damage-mod { color: var(--text-muted); font-size: 12px; }
.w-damage-count { font-weight: 700; }
.w-damage-type { color: var(--text-2); font-size: 11px; }

.w-extra-row {
  display: grid;
  grid-template-columns: 56px minmax(60px, 1fr) minmax(80px, 1fr) auto;
  gap: 6px;
  align-items: center;
  margin-bottom: 4px;
}

.w-count {
  background: var(--surface-raised);
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  color: var(--text-1);
  font: inherit;
  font-size: 13px;
  padding: 5px 8px;
  outline: none;
  text-align: center;
  -moz-appearance: textfield;
}
.w-count::-webkit-outer-spin-button,
.w-count::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.w-count:focus { border-color: var(--accent); }

.w-damage-actions { margin-top: 2px; }
.w-add-damage {
  font-size: 12px;
  color: var(--text-muted);
  background: none;
  border: 1px dashed color-mix(in srgb, var(--text-on-accent) 12%, transparent);
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
  font-family: inherit;
  transition: color 0.12s, border-color 0.12s;
}
.w-add-damage:hover { color: var(--accent); border-color: var(--accent); }

.w-delete-cell { text-align: center; padding: 6px 8px; }
.w-delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  background: color-mix(in srgb, var(--text-on-accent) 4%, transparent);
  border: 1px solid color-mix(in srgb, var(--text-on-accent) 8%, transparent);
  border-radius: 6px;
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.15s, border-color 0.12s;
}
.w-delete:hover { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 40%, transparent); }
.w-cross {
  position: relative;
  width: 10px;
  height: 10px;
}
.w-cross::before, .w-cross::after {
  content: '';
  position: absolute;
  inset: 50% 0 auto 0;
  height: 1.4px;
  background: currentColor;
}
.w-cross::before { transform: rotate(45deg); }
.w-cross::after { transform: rotate(-45deg); }

.w-props-text {
  padding: 6px 10px;
  font-size: 12px;
  color: var(--text-2);
}
.w-props-sep { color: var(--text-muted); }
.w-prop { color: var(--text-1); }
.w-prop-has-desc { cursor: help; border-bottom: 1px dashed color-mix(in srgb, var(--text-on-accent) 14%, transparent); }

.w-desc-row td {
  padding: 4px 10px 8px;
}

.w-desc-text {
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.45;
}

.w-note-editor-row {
  padding: 4px 0;
}
</style>
