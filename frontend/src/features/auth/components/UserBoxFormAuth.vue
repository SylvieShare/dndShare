<template>
  <div class="auth-wrap">
    <!-- Header triggers (form lives in the modal) -->
    <div class="auth-actions">
      <button class="auth-btn" type="button" @click="mobileOpen = true">Войти</button>
      <button class="reg-link" type="button" @click="openReg">Регистрация</button>
    </div>

    <!-- Модальное окно входа -->
    <AppModalFrame v-if="mobileOpen" title="Вход" @close="mobileOpen = false">
      <div class="auth-form" :class="{ shaking: showErrorShake }">
        <FormField label="Логин" vertical>
          <FormTextInput v-model:value="login" placeholder="Введите логин" autocomplete="username" :disabled="processAuth" />
        </FormField>
        <FormField label="Пароль" vertical>
          <FormTextInput v-model:value="password" type="password" placeholder="Введите пароль" autocomplete="current-password" :disabled="processAuth" @enter="authMobile" />
        </FormField>
        <transition name="err">
          <div v-if="showError" class="reg-error">Неверный логин или пароль</div>
        </transition>
      </div>
      <template #footer>
        <FormActionButtons cancel-text="Регистрация" submit-text="Войти" loading-text="Вход…" :loading="processAuth" @cancel="openReg" @submit="authMobile" />
      </template>
    </AppModalFrame>

    <!-- Модальное окно регистрации -->
    <AppModalFrame v-if="regOpen" title="Регистрация" @close="closeReg">

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
        <FormActionButtons submit-text="Создать аккаунт" loading-text="Создание…" :loading="reg.busy" :can-submit="canSubmitReg" @cancel="closeReg" @submit="submitReg" />
      </template>
    </AppModalFrame>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { watch } from 'vue'
import AppModalFrame from '@/shared/ui/AppModalFrame.vue'
import { FormActionButtons } from '@sylvieshare/share-ui'
import { FormField } from '@sylvieshare/share-ui'
import { FormTextInput } from '@sylvieshare/share-ui'
import { fetchPost } from "@/shared/api/http"
import { useAccountStore } from '@/stores/account'

const login = ref("")
const password = ref("")
const processAuth = ref(false)
const showError = ref(false)
const showErrorShake = ref(false)
const regOpen = ref(false)
const mobileOpen = ref(false)
const reg = ref({ login: '', password: '', password2: '', busy: false, error: '' })
let showErrorTimeout = null

const canSubmitReg = computed(() => {
  const { login: l, password: p, password2 } = reg.value
  return l.trim().length >= 3 && p.length >= 4 && p === password2
})

function auth() {
  processAuth.value = true
  useAccountStore().login({ login: login.value, password: password.value })
    .then(() => {
      showError.value = false
      processAuth.value = false
    })
    .catch(() => {
      if (showErrorTimeout) clearTimeout(showErrorTimeout)
      if (showError.value) {
        showErrorShake.value = true
        setTimeout(() => { showErrorShake.value = false }, 400)
      } else {
        showError.value = true
      }
      processAuth.value = false
      showErrorTimeout = setTimeout(() => { showError.value = false }, 2500)
    })
}

function authMobile() {
  auth()
  const store = useAccountStore()
  const stop = watch(() => store.authStatus, (status) => {
    if (status === 'success') {
      mobileOpen.value = false
      stop()
    }
  })
}

function openReg() {
  mobileOpen.value = false
  reg.value = { login: '', password: '', password2: '', busy: false, error: '' }
  regOpen.value = true
}

function closeReg() {
  regOpen.value = false
}

async function submitReg() {
  if (!canSubmitReg.value || reg.value.busy) return
  reg.value.busy = true
  reg.value.error = ''
  try {
    await fetchPost('/user/registration', { login: reg.value.login.trim(), password: reg.value.password })
    window.location.reload()
  } catch {
    reg.value.error = 'Логин уже занят'
    reg.value.busy = false
  }
}
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

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
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
</style>
