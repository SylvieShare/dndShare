<template>
  <button class="mobile-header-back" type="button" aria-label="Назад" @click="navigateBack">
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16" aria-hidden="true">
      <path d="M10 13L5 8L10 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <span>Назад</span>
  </button>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { dispatchMobileHeaderBack } from '@/shared/lib/mobileBack'

const router = useRouter()

function navigateBack() {
  if (dispatchMobileHeaderBack()) return
  if (window.history.state?.back) router.back()
  else router.push('/')
}
</script>

<style scoped>
.mobile-header-back { display: none; }

@media (max-width: 640px) {
  .mobile-header-back {
    display: inline-flex;
    align-items: center;
    flex: 0 0 auto;
    gap: 3px;
    height: 34px;
    padding: 0 5px 0 2px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--text-2);
    font: inherit;
    font-size: 12px;
    font-weight: 650;
    cursor: pointer;
  }

  .mobile-header-back:hover { color: var(--text-1); background: var(--surface-raised); }
}
</style>
