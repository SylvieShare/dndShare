<template>
  <div class="dsov">
    <div class="dsov-head">
      <span class="sheet-tile-title">Статусы</span>
      <span v-if="editable" class="dsov-pencil" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </span>
      <span v-if="activeCount" class="dsov-count">{{ activeCount }}</span>
    </div>

    <component
      :is="editable ? 'button' : 'div'"
      class="dsov-conditions"
      :class="{ 'dsov-action': editable, 'dsov-conditions--last': !hasActiveMetrics }"
      :type="editable ? 'button' : undefined"
      @click.stop="select('states')"
    >
      <span class="dsov-label">Состояния</span>
      <span v-if="activeItems.length" class="dsov-chips">
        <span
          v-for="item in activeItems"
          :key="item.id"
          class="dsov-chip"
          :style="{ '--status-color': item.color || 'var(--text-muted)' }"
          @mouseenter="$emit('show-tooltip', $event, item)"
          @mouseleave="$emit('hide-tooltip')"
        >
          <SvgIcon v-if="item.svg" class="dsov-status-icon" :svg="item.svg" :color="item.color || '#888888'" filter />
          <span v-else class="dsov-dot"></span>
          <span class="dsov-name">{{ item.value }}</span>
        </span>
      </span>
      <span v-else class="dsov-empty">нет</span>
    </component>

    <div v-if="hasActiveMetrics" class="dsov-metrics" :class="{ 'dsov-metrics--single': singleActiveMetric }">
      <component
        v-if="exhaustionLevel > 0"
        :is="editable ? 'button' : 'div'"
        class="dsov-metric dsov-metric--exhaustion"
        :class="{ 'dsov-action': editable }"
        :type="editable ? 'button' : undefined"
        @click.stop="select('exhaustion')"
      >
        <BatteryLow class="dsov-metric-icon" :size="18" :stroke-width="1.8" aria-hidden="true" />
        <span class="dsov-metric-copy">
          <span>Истощение</span>
          <strong>{{ exhaustionLevel }} ур.</strong>
        </span>
      </component>

      <component
        v-if="inspirationActive"
        :is="editable ? 'button' : 'div'"
        class="dsov-metric dsov-metric--inspiration"
        :class="{ 'dsov-action': editable }"
        :type="editable ? 'button' : undefined"
        @click.stop="select('inspiration')"
      >
        <Sparkles class="dsov-metric-icon" :size="18" :stroke-width="1.8" aria-hidden="true" />
        <span class="dsov-metric-copy">
          <span>Вдохновение</span>
          <strong>есть</strong>
        </span>
      </component>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { BatteryLow, Sparkles } from '@lucide/vue'
import SvgIcon from '@/shared/ui/SvgIcon'

const props = defineProps({
  activeItems: { type: Array, default: () => [] },
  exhaustionLevel: { type: Number, default: 0 },
  inspirationActive: { type: Boolean, default: false },
  editable: { type: Boolean, default: false },
})

const emit = defineEmits(['select', 'show-tooltip', 'hide-tooltip'])
const activeCount = computed(() => props.activeItems.length + Number(props.exhaustionLevel > 0) + Number(props.inspirationActive))
const hasActiveMetrics = computed(() => props.exhaustionLevel > 0 || props.inspirationActive)
const singleActiveMetric = computed(() => (props.exhaustionLevel > 0) !== props.inspirationActive)

function select(kind) {
  if (props.editable) emit('select', kind)
}
</script>

<style scoped>
.dsov {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 12px 14px 13px;
}

.dsov-head { display: flex; align-items: center; gap: 8px; min-height: 18px; }
.dsov-pencil { display: grid; place-items: center; flex-shrink: 0; color: var(--text-muted); }
.dsov-count {
  display: grid;
  place-items: center;
  min-width: 19px;
  height: 19px;
  margin-left: auto;
  padding: 0 5px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 13%, transparent);
  color: var(--accent-soft);
  box-sizing: border-box;
  font-size: 10px;
  font-weight: 800;
}

.dsov-conditions {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  min-width: 0;
  min-height: 38px;
  margin-top: 7px;
  padding: 7px 0 9px;
  border: 0;
  border-bottom: 1px solid var(--border);
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
}
.dsov-conditions--last { padding-bottom: 2px; border-bottom: 0; }

.dsov-label {
  flex: 0 0 72px;
  padding-top: 2px;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 650;
}

.dsov-chips { display: flex; align-items: center; gap: 7px 10px; flex: 1; flex-wrap: wrap; min-width: 0; }
.dsov-chip { display: inline-flex; align-items: center; gap: 5px; min-width: 0; max-width: 150px; color: var(--status-color); }
.dsov-status-icon { display: inline-flex; width: 18px; height: 18px; flex: 0 0 auto; }
.dsov-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--status-color); flex: 0 0 auto; }
.dsov-name { overflow: hidden; color: var(--text-1); font-size: 12px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.dsov-empty { padding-top: 2px; color: var(--text-muted); font-size: 12px; }

.dsov-metrics { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0; padding-top: 9px; }
.dsov-metrics--single { grid-template-columns: minmax(0, 1fr); }
.dsov-metric {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  min-height: 34px;
  padding: 2px 9px 2px 0;
  border: 0;
  background: none;
  color: var(--text-muted);
  font: inherit;
  text-align: left;
}
.dsov-metric + .dsov-metric { padding-left: 11px; border-left: 1px solid var(--border); }
.dsov-metric-icon { flex: 0 0 auto; }
.dsov-metric-copy { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.dsov-metric-copy span { overflow: hidden; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.dsov-metric-copy strong { color: var(--text-2); font-size: 12px; line-height: 1.2; }
.dsov-metric--exhaustion { color: var(--danger); }
.dsov-metric--exhaustion strong { color: var(--danger); }
.dsov-metric--inspiration { color: var(--accent-soft); }
.dsov-metric--inspiration strong { color: var(--accent-soft); }
.dsov-action { cursor: pointer; border-radius: var(--r-sm); }

@media (hover: hover) {
  .dsov-action:hover { background: color-mix(in srgb, var(--accent) 7%, transparent); }
  .dsov-conditions.dsov-action:hover { margin-inline: -7px; padding-inline: 7px; width: calc(100% + 14px); }
  .dsov-metric.dsov-action:hover { background: color-mix(in srgb, currentColor 7%, transparent); }
}
</style>
