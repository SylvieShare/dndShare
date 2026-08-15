<template>
  <div class="admin-users">
    <div v-if="loading" class="state-msg">Загрузка...</div>
    <div v-else-if="error" class="state-msg error">{{ error }}</div>
    <template v-else>
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Логин</th>
            <th>Зарегистрирован</th>
            <th>Роли</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td class="col-id">{{ user.id }}</td>
            <td>{{ user.login }}</td>
            <td class="col-date">{{ formatDate(user.createdAt) }}</td>
            <td class="col-roles">
              <span v-for="role in user.roles" :key="role" class="role-badge">
                {{ role }}
                <button class="role-remove" @click="onRemoveRole(user, role)" title="Удалить роль">×</button>
              </span>
              <span v-if="!user.roles.length" class="no-roles">—</span>
            </td>
            <td class="col-action">
              <div class="menu-wrap" v-click-outside="() => closeMenu(user.id)">
                <button class="btn-dots" @click="toggleMenu(user.id)">•••</button>
                <div v-if="openMenu === user.id" class="dropdown">
                  <template v-if="availableRoles(user).length">
                    <button
                      v-for="role in availableRoles(user)"
                      :key="role"
                      class="dropdown-item"
                      @click="onAddRole(user, role)"
                    >
                      + {{ role }}
                    </button>
                    <div class="dropdown-divider" />
                  </template>
                  <button class="dropdown-item" @click="openPasswordReset(user)">
                    Сбросить пароль
                  </button>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </template>

    <AppModalFrame v-if="passwordModal" :title="`Сброс пароля — ${passwordModal.login}`" @close="closePasswordReset">
      <FormField label="Новый пароль" vertical>
        <FormTextInput
          v-model:value="newPassword"
          type="password"
          autocomplete="new-password"
          autofocus
          @enter="submitPasswordReset"
        />
      </FormField>
      <template #footer>
        <FormActionButtons
          submit-text="Сохранить"
          loading-text="Сохранение..."
          :loading="resetting"
          :can-submit="!!newPassword.trim()"
          @cancel="closePasswordReset"
          @submit="submitPasswordReset"
        />
      </template>
    </AppModalFrame>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import AppModalFrame from '@/shared/ui/AppModalFrame.vue'
import { FormActionButtons } from '@sylvieshare/share-ui'
import { FormField } from '@sylvieshare/share-ui'
import { FormTextInput } from '@sylvieshare/share-ui'
import { addRole, getUsers, removeRole, resetPassword } from '../api/adminApi'

const ALL_ROLES = ['ADMIN', 'HANDBOOK_ADMIN', 'ERROR_REPORT_AUTO_APPROVE', 'ERROR_REPORT_REVIEWER']

const users = ref([])
const loading = ref(true)
const error = ref('')
const openMenu = ref(null)
const passwordModal = ref(null)
const newPassword = ref('')
const resetting = ref(false)

function toggleMenu(userId) {
  openMenu.value = openMenu.value === userId ? null : userId
}

function closeMenu(userId) {
  if (openMenu.value === userId) openMenu.value = null
}

function availableRoles(user) {
  return ALL_ROLES.filter(r => !user.roles.includes(r))
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await getUsers()
    users.value = res.users
  } catch {
    error.value = 'Ошибка загрузки пользователей'
  } finally {
    loading.value = false
  }
}

async function onAddRole(user, role) {
  openMenu.value = null
  await addRole(user.id, role)
  await load()
}

async function onRemoveRole(user, role) {
  await removeRole(user.id, role)
  await load()
}

function openPasswordReset(user) {
  openMenu.value = null
  newPassword.value = ''
  passwordModal.value = user
}

function closePasswordReset() {
  passwordModal.value = null
  newPassword.value = ''
}

async function submitPasswordReset() {
  if (!newPassword.value.trim() || resetting.value) return
  resetting.value = true
  try {
    await resetPassword(passwordModal.value.id, newPassword.value.trim())
    closePasswordReset()
  } finally {
    resetting.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.admin-users {
  padding: 24px;
  overflow-x: auto;
}

.state-msg {
  color: var(--text-2);
  font-size: 14px;
  padding: 16px 0;
}

.state-msg.error {
  color: var(--danger);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table th {
  text-align: left;
  color: var(--text-2);
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 8px 12px;
  border-bottom: 1px solid var(--surface-raised);
}

.data-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--surface);
  vertical-align: middle;
  color: var(--text-1);
}

.col-id {
  color: var(--text-2);
  width: 48px;
}

.col-date {
  color: var(--text-2);
  font-size: 12px;
  white-space: nowrap;
}

.col-roles {
  width: 100%;
}

.col-action {
  width: 40px;
}

.role-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent-soft);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 600;
  margin: 2px;
}

.role-remove {
  background: none;
  border: none;
  color: var(--accent-soft);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0;
  opacity: 0.7;
}

.role-remove:hover {
  opacity: 1;
}

.no-roles {
  color: var(--text-2);
}

.menu-wrap {
  position: relative;
  display: inline-block;
}

.btn-dots {
  background: none;
  border: none;
  border-radius: 6px;
  color: var(--text-2);
  cursor: pointer;
  font-size: 13px;
  letter-spacing: 1px;
  padding: 4px 8px;
}

.btn-dots:hover {
  background: var(--surface);
  color: var(--text-1);
}

.dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 50;
  min-width: 172px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px;
  border: 1px solid var(--surface-raised);
  border-radius: 8px;
  background: var(--popover-bg);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--scrim) 65%, transparent);
}

.dropdown-divider {
  height: 1px;
  background: var(--surface-raised);
  margin: 4px 0;
}

.dropdown-item {
  background: none;
  border: none;
  border-radius: 6px;
  color: var(--text-1);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  padding: 6px 10px;
  text-align: left;
  white-space: nowrap;
}

.dropdown-item:hover {
  background: var(--surface-raised);
  color: var(--text-on-accent);
}

</style>
