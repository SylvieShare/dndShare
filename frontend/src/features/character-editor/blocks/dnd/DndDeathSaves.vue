<template>
  <Transition name="ds">
    <div v-if="isDead" class="ds-overlay" @click.stop>
      <div class="ds-tracks">
        <div class="ds-side ds-side-fail">
          <div class="ds-pips">
            <button
              type="button"
              v-for="i in [3, 2, 1]"
              :key="i"
              class="ds-pip ds-pip-fail"
              :aria-label="`Провалы: ${i}`" :aria-pressed="i <= ds.failure"
              :class="{ filled: i <= ds.failure }"
              @click="togglePip('failure', i)"
            />
          </div>
          <span class="ds-label ds-label-fail">Провалы</span>
        </div>
        <img class="ds-heart" src="/static/hp-pulse.svg" alt="" />
        <div class="ds-side ds-side-success">
          <div class="ds-pips">
            <button
              type="button"
              v-for="i in [1, 2, 3]"
              :key="i"
              class="ds-pip ds-pip-success"
              :aria-label="`Успехи: ${i}`" :aria-pressed="i <= ds.success"
              :class="{ filled: i <= ds.success }"
              @click="togglePip('success', i)"
            />
          </div>
          <span class="ds-label ds-label-success">Успехи</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  hp: { type: Object, required: true },
})
const emit = defineEmits(['change'])
const isDead = computed(() => (parseInt(props.hp.current) || 0) <= 0)
const ds = computed(() => ({
  success: Math.max(0, Math.min(3, parseInt(props.hp.ds_success) || 0)),
  failure: Math.max(0, Math.min(3, parseInt(props.hp.ds_failure) || 0)),
}))

function togglePip(type, index) {
  const current = ds.value[type]
  const next = current === index ? index - 1 : index
  if (type === 'success' && next === 3) {
    emit('change', { ...props.hp, current: 1, ds_success: 0, ds_failure: 0 })
    return
  }
  const key = type === 'success' ? 'ds_success' : 'ds_failure'
  emit('change', { ...props.hp, [key]: next })
}
</script>

<style scoped>
.ds-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--surface, var(--bg)) 60%, transparent);
  border-radius: inherit;
  z-index: 1;
}

.ds-tracks { display: flex; align-items: center; gap: 14px; }
.ds-side   { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.ds-pips   { display: flex; gap: 0; }

.ds-heart {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  filter: invert(30%) sepia(80%) saturate(700%) hue-rotate(330deg) brightness(0.85);
  animation: ds-heartbeat 1.4s ease-in-out infinite;
}

@keyframes ds-heartbeat {
  0%, 100% { transform: scale(1);    opacity: 0.75; }
  10%       { transform: scale(1.28); opacity: 1;    }
  20%       { transform: scale(1);    opacity: 0.75; }
  35%       { transform: scale(1.14); opacity: 0.9;  }
  50%       { transform: scale(1);    opacity: 0.75; }
}

.ds-pip {
  width: 48px; height: 48px; display: grid; place-items: center;
  padding: 0; border: 0; border-radius: 50%; background: none; cursor: pointer;
}
.ds-pip::before {
  content: ''; width: 16px; height: 16px; box-sizing: border-box;
  border-radius: 50%; border: 1px solid var(--border-strong);
  background: var(--surface-raised);
  transition: background-color 0.2s, border-color 0.2s, transform 0.15s;
}
.ds-pip:hover::before { transform: scale(1.15); }
.ds-pip:focus-visible { outline: 2px solid var(--accent-soft); outline-offset: -6px; }
.ds-pip-success.filled::before { background: var(--success); border-color: var(--success); }
.ds-pip-fail.filled::before { background: var(--danger); border-color: var(--danger); }

.ds-label  { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.ds-label-fail    { color: var(--danger); }
.ds-label-success { color: var(--success); }

.ds-enter-active, .ds-leave-active { transition: opacity 0.35s ease, transform 0.35s ease; }
.ds-enter-from, .ds-leave-to       { opacity: 0; transform: scale(0.88) translateY(4px); }
</style>
