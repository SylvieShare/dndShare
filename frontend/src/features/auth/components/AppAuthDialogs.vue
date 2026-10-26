<template>
  <!-- Модальное окно входа -->
  <AppModalFrame v-if="dialog.view === 'login'" title="Вход" @close="dialog.close">
    <p v-if="dialog.hint" class="auth-hint">{{ dialog.hint }}</p>
    <div class="auth-form" :class="{ shaking: showErrorShake }">
      <FormField label="Логин" vertical>
        <FormTextInput v-model:value="login" placeholder="Введите логин" autocomplete="username" :disabled="processAuth" />
      </FormField>
      <FormField label="Пароль" vertical>
        <FormTextInput v-model:value="password" type="password" placeholder="Введите пароль" autocomplete="current-password" :disabled="processAuth" @enter="submitLogin" />
      </FormField>
      <transition name="err">
        <div v-if="showError" class="reg-error">Неверный логин или пароль</div>
      </transition>
    </div>
    <template #footer>
      <FormActionButtons cancel-text="Регистрация" submit-text="Войти" loading-text="Вход…" :loading="processAuth" @cancel="dialog.openRegistration" @submit="submitLogin" />
    </template>
  </AppModalFrame>

  <!-- Модальное окно регистрации -->
  <AppModalFrame v-if="dialog.view === 'registration'" title="Регистрация" @close="dialog.close">
    <p v-if="dialog.hint" class="auth-hint">{{ dialog.hint }}</p>

    <FormField label="Логин" vertical>
      <FormTextInput v-model:value="reg.login" placeholder="Придумайте логин" autocomplete="username" :disabled="reg.busy" @enter="submitReg" />
    </FormField>
    <FormField label="Пароль" vertical>
      <FormTextInput v-model:value="reg.password" type="password" placeholder="Придумайте пароль" autocomplete="new-password" :disabled="reg.busy" @enter="submitReg" />
    </FormField>
    <FormField label="Повторите пароль" vertical>
      <FormTextInput v-model:value="reg.password2" type="password" placeholder="Повторите пароль" autocomplete="new-password" :disabled="reg.busy" :invalid="!!reg.password2 && reg.password !== reg.password2" @enter="submitReg" />
    </FormField>

    <transition name="err">
      <div v-if="reg.error" class="reg-error">{{ reg.error }}</div>
    </transition>

    <template #footer>
      <FormActionButtons submit-text="Создать аккаунт" loading-text="Создание…" :loading="reg.busy" :can-submit="canSubmitReg" @cancel="dialog.close" @submit="submitReg" />
    </template>
  </AppModalFrame>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { AppModalFrame, FormActionButtons, FormField, FormTextInput } from '@sylvieshare/share-ui'
import { fetchPost } from '@/shared/api/http'
import { useAccountStore } from '@/stores/account'
import { useAuthDialogStore } from '@/stores/authDialog'

const account = useAccountStore()
const dialog = useAuthDialogStore()
const login = ref('')
const password = ref('')
const processAuth = ref(false)
const showError = ref(false)
const showErrorShake = ref(false)
const emptyRegistration = () => ({ login: '', password: '', password2: '', busy: false, error: '' })
const reg = ref(emptyRegistration())
let showErrorTimeout = null
let shakeTimeout = null
let disposed = false

function clearErrorTimers() {
  clearTimeout(showErrorTimeout)
  clearTimeout(shakeTimeout)
  showErrorTimeout = null
  shakeTimeout = null
}

watch(() => dialog.view, view => {
  clearErrorTimers()
  showError.value = false
  showErrorShake.value = false
  if (view === 'registration') reg.value = emptyRegistration()
}, { immediate: true })

function openRequestedAuth(event) {
  dialog.openLogin(event.detail?.reason)
}
onMounted(() => window.addEventListener('dndshare:request-auth', openRequestedAuth))
onBeforeUnmount(() => {
  disposed = true
  window.removeEventListener('dndshare:request-auth', openRequestedAuth)
  clearErrorTimers()
  dialog.close()
})

const canSubmitReg = computed(() => {
  const { login: name, password: value, password2 } = reg.value
  return name.trim().length >= 3 && value.length >= 4 && value === password2
})

async function submitLogin() {
  if (processAuth.value) return
  processAuth.value = true
  try {
    await account.login({ login: login.value, password: password.value })
    if (!disposed) dialog.close()
  } catch {
    if (disposed || dialog.view !== 'login') return
    clearErrorTimers()
    if (showError.value) {
      showErrorShake.value = true
      shakeTimeout = setTimeout(() => { showErrorShake.value = false }, 400)
    }
    showError.value = true
    showErrorTimeout = setTimeout(() => { showError.value = false }, 2500)
  } finally {
    processAuth.value = false
  }
}

async function submitReg() {
  if (!canSubmitReg.value || reg.value.busy) return
  const form = reg.value
  form.busy = true
  form.error = ''
  try {
    await fetchPost('/user/registration', { login: form.login.trim(), password: form.password })
    if (!disposed) window.location.reload()
  } catch {
    if (!disposed) {
      form.error = 'Логин уже занят'
      form.busy = false
    }
  }
}
</script>

<style scoped>
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.auth-hint {
  margin: 0 0 14px;
  padding: 9px 11px;
  border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent) 9%, var(--surface));
  color: var(--text-2);
  font-size: 12px;
  line-height: 1.45;
}

.reg-error {
  font-size: 12px;
  color: var(--danger);
  background: var(--bg);
  border: 1px solid var(--surface-raised);
  border-radius: 6px;
  padding: 6px 12px;
}

/* ─── Анимации ──────────────────────────────────── */
.err-enter-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.err-leave-active { transition: opacity 0.15s ease; }
.err-enter-from { opacity: 0; transform: translateY(-4px); }
.err-leave-to { opacity: 0; }

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%       { transform: translateX(-6px); }
  40%       { transform: translateX(6px); }
  60%       { transform: translateX(-4px); }
  80%       { transform: translateX(4px); }
}
.shaking { animation: shake 0.35s ease; }
@media (prefers-reduced-motion: reduce) {
  .err-enter-active,
  .err-leave-active { transition: none; }
  .err-enter-from { transform: none; }
  .shaking { animation: none; }
}
</style>
