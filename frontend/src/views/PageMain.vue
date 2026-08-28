<template>
  <main class="home-page">
    <HomeHero />
    <HomeFeatureGrid />
  </main>
</template>

<script setup>
import HomeFeatureGrid from '@/features/home/components/HomeFeatureGrid.vue'
import HomeHero from '@/features/home/components/HomeHero.vue'
</script>

<style scoped>
.home-page {
  box-sizing: border-box;
  width: min(1320px, 100%);
  min-height: 100dvh;
  margin: 0 auto;
  padding: clamp(24px, 4vw, 54px) clamp(18px, 4vw, 52px) 56px;
}

@media (max-width: 700px) {
  .home-page {
    min-height: calc(100dvh - var(--header-h));
    padding-top: 20px;
  }
}
</style>
