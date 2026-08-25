<template>
  <div class="dsov">
    <div class="dsov-head">
      <span class="sheet-tile-title">Эффекты</span>
      <span v-if="activeCount" class="dsov-count">{{ activeCount }}</span>
    </div>

    <div class="dsov-row">
      <component
        :is="editable ? 'button' : 'div'"
        v-for="item in activeItems"
        :key="item.id"
        class="dsov-entry"
        :class="{ 'dsov-entry--action': editable }"
        :type="editable ? 'button' : undefined"
        @click.stop="select('states')"
        @mouseenter="$emit('show-tooltip', $event, item)"
        @mouseleave="$emit('hide-tooltip')"
      >
        <span class="dsov-icon" :style="{ '--status-color': item.color || 'var(--text-muted)' }">
          <SvgIcon v-if="item.svg" class="dsov-status-icon" :svg="item.svg" :color="item.color || '#888888'" filter />
          <span v-else class="dsov-dot"></span>
        </span>
        <span class="dsov-name">{{ item.value }}</span>
      </component>

      <component
        :is="editable ? 'button' : 'div'"
        v-if="exhaustionLevel > 0"
        class="dsov-entry dsov-entry--exhaustion"
        :class="{ 'dsov-entry--action': editable }"
        :type="editable ? 'button' : undefined"
        :title="exhaustionTitle"
        @click.stop="select('exhaustion')"
      >
        <span class="dsov-icon">
          <BatteryLow :size="38" :stroke-width="1.7" aria-hidden="true" />
        </span>
        <span class="dsov-name">Истощение {{ exhaustionLevel }}</span>
      </component>

      <component
        :is="editable ? 'button' : 'div'"
        v-if="inspirationActive"
        class="dsov-entry dsov-entry--inspiration"
        :class="{ 'dsov-entry--action': editable }"
        :type="editable ? 'button' : undefined"
        @click.stop="select('inspiration')"
      >
        <span class="dsov-icon">
          <Sparkles :size="40" :stroke-width="1.7" aria-hidden="true" />
        </span>
        <span class="dsov-name">Вдохновение</span>
      </component>

      <button
        v-if="editable"
        class="dsov-entry dsov-entry--action dsov-entry--add"
        type="button"
        @click.stop="$emit('add-effect')"
      >
        <span class="dsov-icon"><Plus :size="32" :stroke-width="1.7" aria-hidden="true" /></span>
        <span class="dsov-name">Добавить эффект</span>
      </button>

      <button
        v-if="editable && !inspirationActive"
        class="dsov-entry dsov-entry--action dsov-entry--add dsov-entry--add-inspiration"
        type="button"
        @click.stop="$emit('add-inspiration')"
      >
        <span class="dsov-icon"><Sparkles :size="34" :stroke-width="1.7" aria-hidden="true" /></span>
        <span class="dsov-name">Добавить вдохновение</span>
      </button>

      <span v-if="!editable && activeCount === 0" class="dsov-empty">Активных эффектов нет</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { BatteryLow, Plus, Sparkles } from '@lucide/vue'
import SvgIcon from '@/shared/ui/SvgIcon'

const props = defineProps({
  activeItems: { type: Array, default: () => [] },
  exhaustionLevel: { type: Number, default: 0 },
  exhaustionEffects: { type: Array, default: () => [] },
  inspirationActive: { type: Boolean, default: false },
  editable: { type: Boolean, default: false },
})

const emit = defineEmits(['select', 'add-effect', 'add-inspiration', 'show-tooltip', 'hide-tooltip'])
const activeCount = computed(() => props.activeItems.length + Number(props.exhaustionLevel > 0) + Number(props.inspirationActive))
const exhaustionTitle = computed(() => props.exhaustionEffects.length
  ? props.exhaustionEffects.join(' · ')
  : `Истощение ${props.exhaustionLevel} уровня`)

function select(kind) {
  if (props.editable) emit('select', kind)
}
</script>

<style scoped>
.dsov { display: flex; min-width: 0; flex-direction: column; padding: 12px 14px 13px; }
.dsov-head { display: flex; min-height: 18px; align-items: center; gap: 8px; }
.dsov-count {
  display: grid;
  min-width: 19px;
  height: 19px;
  place-items: center;
  padding: 0 5px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 13%, transparent);
  color: var(--accent-soft);
  box-sizing: border-box;
  font-size: 10px;
  font-weight: 800;
}
.dsov-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
  margin-top: 10px;
  padding-bottom: 2px;
  overflow-x: auto;
  scrollbar-width: thin;
}
.dsov-entry {
  display: flex;
  width: 72px;
  min-width: 0;
  flex: 0 0 72px;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: center;
}
.dsov-icon {
  display: grid;
  width: 64px;
  height: 64px;
  place-items: center;
  flex: 0 0 64px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--status-color, var(--accent)) 34%, var(--border));
  border-radius: var(--r-md);
  background: color-mix(in srgb, var(--status-color, var(--accent)) 9%, var(--surface-raised));
  color: var(--status-color, var(--accent-soft));
  box-sizing: border-box;
  transition: border-color 0.14s, background 0.14s, transform 0.14s;
}
.dsov-status-icon { width: 52px; height: 52px; }
.dsov-dot { width: 18px; height: 18px; border-radius: 50%; background: var(--status-color); }
.dsov-name {
  display: -webkit-box;
  overflow: hidden;
  max-width: 72px;
  min-height: 24px;
  color: var(--text-2);
  font-size: 10px;
  font-weight: 650;
  line-height: 1.2;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.dsov-entry--exhaustion { --status-color: var(--danger); }
.dsov-entry--inspiration,
.dsov-entry--add-inspiration { --status-color: var(--accent); }
.dsov-entry--add { --status-color: var(--text-muted); }
.dsov-entry--add .dsov-icon { border-style: dashed; }
.dsov-entry--action { cursor: pointer; }
.dsov-empty { align-self: center; padding: 20px 4px; color: var(--text-muted); font-size: 12px; }

@media (hover: hover) {
  .dsov-entry--action:hover .dsov-icon {
    border-color: var(--status-color, var(--accent));
    background: color-mix(in srgb, var(--status-color, var(--accent)) 15%, var(--surface-raised));
    transform: translateY(-1px);
  }
}
</style>
