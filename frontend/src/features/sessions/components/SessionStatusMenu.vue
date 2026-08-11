<template>
  <div class="session-status-menu">
    <RowActionMenu title="Статус сессии">
      <template #trigger>
        <button class="session-menu-btn" type="button" title="Меню сессии" aria-label="Меню сессии">
          <span class="bar" />
          <span class="bar" />
          <span class="bar" />
        </button>
      </template>

      <template #default="{ close }">
        <div class="ram-label">Статус сессии</div>
        <div class="status-current" :style="{ '--dot': statusCfg.color }">
          <span class="status-dot" />{{ statusCfg.label }}
        </div>
        <button
          v-for="opt in STATUS_OPTIONS"
          :key="opt.key"
          class="ram-item status-option"
          :class="{ 'status-option--active': session.status === opt.key }"
          :style="{ '--dot': STATUS_CFG[opt.key].color }"
          type="button"
          @click="changeStatus(opt.key, close)"
        >
          <span class="status-dot" />{{ opt.label }}
        </button>
      </template>
    </RowActionMenu>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import RowActionMenu from '@/shared/ui/RowActionMenu.vue'
import { STATUS_CFG, STATUS_OPTIONS, useSessionStatus } from '@/features/sessions/composables/useSessionStatus'

const props = defineProps({
  session: { type: Object, required: true },
  sessionUuid: { type: String, required: true },
})
const emit = defineEmits(['status-change'])

const sessionRef = ref(props.session)
watch(() => props.session, value => { sessionRef.value = value })

const { statusCfg, setStatus: persistStatus } =
  useSessionStatus({ session: sessionRef, sessionUuid: props.sessionUuid })

async function changeStatus(key, close) {
  const previous = sessionRef.value?.status
  await persistStatus(key)
  close()
  if (sessionRef.value?.status !== previous) emit('status-change', sessionRef.value.status)
}
</script>

<style scoped>
.session-status-menu { margin-left: auto; }

.session-menu-btn {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  width: 30px;
  height: 30px;
  padding: 0;
  background: none;
  border: 1px solid color-mix(in srgb, var(--text-on-accent) 10%, transparent);
  border-radius: 6px;
  color: var(--text-2);
  cursor: pointer;
}

.session-menu-btn:hover { background: color-mix(in srgb, var(--text-on-accent) 6%, transparent); color: var(--text-1); }
.bar { width: 14px; height: 1.5px; border-radius: 2px; background: currentColor; }

.status-current, .status-option { display: flex; align-items: center; gap: 7px; }
.status-current { padding: 7px 10px; color: var(--dot); font-size: 12px; font-weight: 700; }
.status-option { color: var(--text-2); }
.status-option:hover, .status-option--active { color: var(--text-1); }
.status-option--active { background: color-mix(in srgb, var(--accent) 10%, transparent); }
.status-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--dot); flex-shrink: 0; }
</style>
