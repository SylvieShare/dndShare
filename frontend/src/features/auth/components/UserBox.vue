<template>
  <div class="user-box">
    <transition name="fade" mode="out-in">
      <UserBoxFormAuth v-if="authStatus === 'none' || authStatus === 'process'" key="auth" />
      <UserBoxInfo v-else-if="authStatus === 'success'" key="info" :expanded="expanded" />
    </transition>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import UserBoxFormAuth from "@/features/auth/components/UserBoxFormAuth"
import UserBoxInfo from "@/features/auth/components/UserBoxInfo"
import { useAccountStore } from '@/stores/account'

defineProps({ expanded: { type: Boolean, default: true } })

const authStatus = computed(() => useAccountStore().authStatus)
</script>

<style scoped>
.user-box {
  display: flex;
  align-items: center;
}

.fade-enter-active { transition: opacity 0.15s ease; }
.fade-leave-active { transition: opacity 0.1s ease; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }
</style>
