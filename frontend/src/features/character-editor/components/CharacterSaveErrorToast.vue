<template>
  <Teleport to="body">
    <Transition name="save-error-toast">
      <aside v-if="visible" class="save-error" role="alert" aria-live="assertive">
        <AlertTriangle class="save-error-icon" :size="20" :stroke-width="1.8" aria-hidden="true" />
        <span class="save-error-copy">
          <strong>Не удалось сохранить лист</strong>
          <small>Проверьте соединение и попробуйте снова.</small>
        </span>
        <button class="save-error-retry" type="button" @click="$emit('retry')">Повторить</button>
        <button class="save-error-close" type="button" aria-label="Закрыть" @click="$emit('dismiss')">
          <X :size="16" :stroke-width="1.8" aria-hidden="true" />
        </button>
      </aside>
    </Transition>
  </Teleport>
</template>

<script setup>
import { AlertTriangle, X } from '@lucide/vue'

defineProps({ visible: { type: Boolean, default: false } })
defineEmits(['retry', 'dismiss'])
</script>

<style scoped>
.save-error {
  position: fixed;
  top: max(16px, env(safe-area-inset-top));
  right: max(16px, env(safe-area-inset-right));
  z-index: 5600;
  display: flex;
  width: min(390px, calc(100vw - 32px));
  box-sizing: border-box;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--danger) 55%, var(--border));
  border-radius: var(--r-md);
  background: color-mix(in srgb, var(--popover-bg) 94%, var(--danger));
  box-shadow: var(--shadow-lg);
  color: var(--text-1);
}
.save-error-icon { flex: 0 0 auto; color: var(--danger); }
.save-error-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 2px; }
.save-error-copy strong { font-size: 12px; }
.save-error-copy small { color: var(--text-muted); font-size: 10px; line-height: 1.35; }
.save-error-retry,
.save-error-close { border: 0; background: transparent; color: var(--text-2); font: inherit; cursor: pointer; }
.save-error-retry { padding: 6px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; }
.save-error-retry:hover { background: color-mix(in srgb, var(--danger) 12%, transparent); color: var(--text-1); }
.save-error-close { display: grid; width: 28px; height: 28px; flex: 0 0 auto; padding: 0; place-items: center; border-radius: 50%; }
.save-error-close:hover { background: color-mix(in srgb, var(--text-on-accent) 7%, transparent); }
.save-error-toast-enter-active,
.save-error-toast-leave-active { transition: opacity 0.16s, transform 0.16s; }
.save-error-toast-enter-from,
.save-error-toast-leave-to { opacity: 0; transform: translateY(-8px); }
</style>
