<template>
  <div class="auth-wrap">
    <!-- The persistent auth dialog host belongs to AppNavigationShell. -->
    <div class="auth-actions">
      <button
        class="auth-btn"
        :class="{ 'auth-btn--compact': !expanded }"
        type="button"
        :title="expanded ? undefined : 'Войти'"
        aria-label="Войти"
        @click="dialog.openLogin()"
      >
        <LogIn v-if="!expanded" :size="18" aria-hidden="true" />
        <span v-else>Войти</span>
      </button>
      <button v-if="expanded" class="reg-link" type="button" @click="dialog.openRegistration">Регистрация</button>
    </div>
  </div>
</template>

<script setup>
import { LogIn } from '@lucide/vue'
import { useAuthDialogStore } from '@/stores/authDialog'

defineProps({ expanded: { type: Boolean, default: true } })
const dialog = useAuthDialogStore()
</script>

<style scoped>
.auth-wrap {
  position: relative;
}

.auth-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.auth-btn {
  height: 34px;
  padding: 0 16px;
  background: var(--accent);
  border: none;
  border-radius: 6px;
  color: var(--text-on-accent);
  font-size: 13px;
  font-family: inherit;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}
.auth-btn:hover:not(:disabled) { background: var(--accent-hover); }
.auth-btn:disabled { opacity: 0.6; cursor: default; }

.auth-btn--compact {
  display: grid;
  width: 42px;
  padding: 0;
  place-items: center;
}

.reg-link {
  background: none;
  border: none;
  color: var(--text-2);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  padding: 0 4px;
  white-space: nowrap;
  transition: color 0.15s;
}
.reg-link:hover { color: var(--text-1); }

</style>
