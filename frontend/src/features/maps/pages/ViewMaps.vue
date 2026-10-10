<template>
  <main class="maps-page">
    <header>
      <span>МАСТЕРСКАЯ</span>
      <h1>Карты</h1>
      <p>Подготовьте место для следующей истории. Рисуйте свои карты или начните с готовой.</p>
    </header>
    <MapLibrary v-if="account.authStatus === 'success'" />
    <p v-else-if="account.authStatus === 'none'" role="status">Войдите, чтобы открыть карты.</p>
  </main>
</template>
<script setup>
import { onMounted } from 'vue';
import MapLibrary from '../components/MapLibrary.vue';
import { useAccountStore } from '@/stores/account';
const account = useAccountStore();
onMounted(() => account.ensureAuth());
</script>
<style scoped>
.maps-page {
  max-width: 1500px;
  margin: 0 auto;
  padding: 36px 28px;
}
.maps-page header {
  margin-bottom: 30px;
}
.maps-page header > span {
  color: var(--accent);
  letter-spacing: 0.18em;
  font-size: 10px;
  font-weight: 700;
}
.maps-page h1 {
  margin: 10px 0;
  font-family: var(--font-display);
  font-size: 40px;
  color: var(--text-1);
}
.maps-page p {
  color: var(--text-muted);
  font-size: 14px;
}
@media (max-width: 760px) {
  .maps-page {
    padding: 24px 16px;
  }
}
</style>
