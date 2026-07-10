<template>
  <div class="user-info" v-click-outside="closeMenu">
    <button class="user-trigger" :class="{ open: menuOpen }" @click="menuOpen = !menuOpen">
      <div class="user-avatar">{{ initial }}</div>
      <span class="user-name">{{ username }}</span>
      <span class="trigger-arrow">▾</span>
    </button>
    <div v-if="menuOpen" class="user-menu">
      <button class="user-menu-item logout" @click="logout">Выйти</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAccountStore } from '@/stores/account'

const menuOpen = ref(false)

const username = computed(() => useAccountStore().user.login)
const initial = computed(() => (username.value?.[0] ?? '?').toUpperCase())

function logout() {
  menuOpen.value = false
  useAccountStore().logout()
}

function closeMenu() {
  menuOpen.value = false
}
</script>

<style scoped>
.user-info {
  position: relative;
}

.user-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: none;
  border-radius: 7px;
  padding: 3px 6px 3px 3px;
  cursor: pointer;
  transition: background 0.15s;
}

.user-trigger:hover,
.user-trigger.open {
  background: #222228;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  user-select: none;
}

.user-name {
  font-size: 14px;
  color: var(--text-1);
  white-space: nowrap;
}

.trigger-arrow {
  color: var(--text-muted);
  font-size: 11px;
  transition: transform 0.15s ease;
  line-height: 1;
}

.user-trigger.open .trigger-arrow {
  transform: rotate(180deg);
}

.user-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 150;
  min-width: 140px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px;
  border: 1px solid #2a2a2e;
  border-radius: 10px;
  background: #1e1e22;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
}

.user-menu-item {
  background: none;
  border: none;
  font: inherit;
  font-size: 13px;
  text-align: left;
  border-radius: 7px;
  padding: 8px 10px;
  cursor: pointer;
  color: var(--text-2);
  transition: color 0.15s, background 0.15s;
}

.user-menu-item.logout:hover {
  color: #f87171;
  background: #2a1515;
}

@media (max-width: 640px) {
  .user-name {
    display: none;
  }
}
</style>
