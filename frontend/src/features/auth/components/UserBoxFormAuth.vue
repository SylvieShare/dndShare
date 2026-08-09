<template>
  <div class="auth-wrap">
    <!-- Header triggers (form lives in the modal) -->
    <div class="auth-actions">
      <button class="auth-btn" type="button" @click="mobileOpen = true">Войти</button>
      <button class="reg-link" type="button" @click="openReg">Регистрация</button>
    </div>

    <!-- Модальное окно входа -->
    <AppModal v-if="mobileOpen" @close="mobileOpen = false">
      <div class="reg-title">Вход</div>
      <form :class="{ shaking: showErrorShake }" @submit.prevent="authMobile">
        <div class="reg-field">
          <label class="reg-label">Логин</label>
          <input
            class="reg-input"
            type="text"
            placeholder="Введите логин"
            autocomplete="username"
            v-model="login"
            :disabled="processAuth"
          />
        </div>
        <div class="reg-field">
          <label class="reg-label">Пароль</label>
          <input
            class="reg-input"
            type="password"
            placeholder="Введите пароль"
            autocomplete="current-password"
            v-model="password"
            :disabled="processAuth"
          />
        </div>
        <transition name="err">
          <div v-if="showError" class="reg-error">Неверный логин или пароль</div>
        </transition>
        <div class="reg-actions">
          <button class="reg-cancel" type="button" @click="openReg">Регистрация</button>
          <button class="reg-submit" type="submit" :disabled="processAuth">
            {{ processAuth ? '...' : 'Войти' }}
          </button>
        </div>
      </form>
    </AppModal>

    <!-- Модальное окно регистрации -->
    <AppModal v-if="regOpen" @close="closeReg">
      <div class="reg-title">Регистрация</div>

      <div class="reg-field">
        <label class="reg-label">Логин</label>
        <input
          class="reg-input"
          type="text"
          placeholder="Придумайте логин"
          autocomplete="username"
          v-model="reg.login"
          :disabled="reg.busy"
          @keydown.enter="submitReg"
        />
      </div>

      <div class="reg-field">
        <label class="reg-label">Пароль</label>
        <input
          class="reg-input"
          type="password"
          placeholder="Придумайте пароль"
          autocomplete="new-password"
          v-model="reg.password"
          :disabled="reg.busy"
          @keydown.enter="submitReg"
        />
      </div>

      <div class="reg-field">
        <label class="reg-label">Повторите пароль</label>
        <input
          class="reg-input"
          :class="{ invalid: reg.password2 && reg.password !== reg.password2 }"
          type="password"
          placeholder="Повторите пароль"
          autocomplete="new-password"
          v-model="reg.password2"
          :disabled="reg.busy"
          @keydown.enter="submitReg"
        />
      </div>

      <transition name="err">
        <div v-if="reg.error" class="reg-error">{{ reg.error }}</div>
      </transition>

      <div class="reg-actions">
        <button class="reg-cancel" type="button" @click="closeReg">Отмена</button>
        <button
          class="reg-submit"
          type="button"
          :disabled="!canSubmitReg || reg.busy"
          @click="submitReg"
        >{{ reg.busy ? '...' : 'Создать аккаунт' }}</button>
      </div>
    </AppModal>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { watch } from 'vue'
import AppModal from '@/shared/ui/AppModal'
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

.reg-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-1);
}

.reg-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.reg-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.reg-input {
  height: 36px;
  background: var(--surface-raised);
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  color: var(--text-1);
  font-size: 13px;
  font-family: inherit;
  padding: 0 12px;
  outline: none;
  transition: border-color 0.15s, background 0.15s;
}
.reg-input::placeholder { color: var(--text-2); }
.reg-input:focus { border-color: var(--accent); background: var(--surface-active); }
.reg-input:disabled { opacity: 0.5; }
.reg-input.invalid { border-color: var(--surface-raised); }

.reg-error {
  font-size: 12px;
  color: var(--danger);
  background: var(--bg);
  border: 1px solid var(--surface-raised);
  border-radius: 6px;
  padding: 6px 12px;
}

.reg-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.reg-cancel {
  background: none;
  border: 1px solid var(--border-strong);
  color: var(--text-muted);
  font-family: inherit;
  font-size: 13px;
  padding: 7px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.reg-cancel:hover { border-color: var(--text-muted); color: var(--text-muted); }

.reg-submit {
  background: var(--accent);
  border: none;
  color: var(--text-on-accent);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 7px 20px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}
.reg-submit:hover:not(:disabled) { background: var(--accent-hover); }
.reg-submit:disabled { opacity: 0.4; cursor: default; }

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
