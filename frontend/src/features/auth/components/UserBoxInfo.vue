<template>
  <AccountMenu
    :expanded="expanded"
    :label="username"
    :avatar-text="initial"
    title="Действия аккаунта"
  >
    <template #default="{ close }">
      <ActionMenuItem :icon="UserRoundCog" @click="openAccount(close)">
        Аккаунт
      </ActionMenuItem>
      <ActionMenuItem :icon="LogOut" tone="danger" @click="logout(close)">
        Выйти
      </ActionMenuItem>
    </template>
  </AccountMenu>
</template>

<script setup>
import { computed } from 'vue'
import { LogOut, UserRoundCog } from '@lucide/vue'
import { useRouter } from 'vue-router'
import { AccountMenu, ActionMenuItem } from '@sylvieshare/share-ui'
import { useAccountStore } from '@/stores/account'

defineProps({ expanded: { type: Boolean, default: true } })

const accountStore = useAccountStore()
const router = useRouter()
const username = computed(() => accountStore.user.login)
const initial = computed(() => (username.value?.[0] ?? '?').toUpperCase())

function openAccount(closeMenu) {
  closeMenu()
  router.push('/account')
}

function logout(closeMenu) {
  closeMenu()
  accountStore.logout()
}
</script>
