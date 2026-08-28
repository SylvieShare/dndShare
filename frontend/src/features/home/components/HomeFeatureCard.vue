<template>
  <BaseTile
    class="home-feature-card"
    color="var(--accent)"
    interactive
    :framed="feature.framed"
    :tint="feature.tint"
  >
    <div class="home-feature-copy">
      <span class="home-feature-icon">
        <component :is="feature.icon" :size="19" aria-hidden="true" />
      </span>
      <p class="home-feature-kind">{{ feature.kind }}</p>
      <h3>{{ feature.title }}</h3>
      <p class="home-feature-description">{{ feature.description }}</p>
      <span class="home-feature-action">
        {{ feature.action }}
        <ArrowUpRight :size="16" aria-hidden="true" />
      </span>
    </div>

    <HomeFeaturePreview :kind="feature.key" />
  </BaseTile>
</template>

<script setup>
import { ArrowUpRight } from '@lucide/vue'
import { BaseTile } from '@sylvieshare/share-ui'
import HomeFeaturePreview from '@/features/home/components/HomeFeaturePreview.vue'

defineProps({
  feature: { type: Object, required: true },
})
</script>

<style scoped>
.home-feature-card {
  min-height: var(--home-feature-min-height);
  height: 100%;
  overflow: hidden;
  padding: 23px 24px;
  transform: translateY(0);
  transition: background 150ms ease, box-shadow 150ms ease, transform 150ms ease;
}

.home-feature-card:hover {
  transform: translateY(-2px);
}

.home-feature-copy {
  position: relative;
  z-index: 2;
  max-width: var(--home-feature-copy-width);
  min-height: 100%;
  display: flex;
  box-sizing: border-box;
  flex-direction: column;
  align-items: flex-start;
}

.home-feature-icon {
  width: 35px;
  height: 35px;
  display: grid;
  place-items: center;
  margin-bottom: 13px;
  border: 1px solid color-mix(in srgb, var(--accent) 32%, var(--border));
  border-radius: var(--r-md);
  background: color-mix(in srgb, var(--accent) 10%, var(--surface-raised));
  color: var(--accent-soft);
}

.home-feature-kind {
  margin: 0 0 5px;
  color: var(--accent-soft);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.home-feature-copy h3 {
  max-width: 430px;
  margin: 0;
  color: var(--text-1);
  font-family: var(--font-display);
  font-size: clamp(22px, 2.2vw, 29px);
  font-weight: 650;
  letter-spacing: -0.01em;
  line-height: 1.02;
}

.home-feature-description {
  max-width: var(--home-feature-description-width);
  margin: 11px 0 18px;
  color: var(--text-2);
  font-size: 11px;
  line-height: 1.55;
}

.home-feature-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: auto;
  color: var(--text-1);
  font-size: 11px;
  font-weight: 750;
}

.home-feature-action svg {
  color: var(--accent-soft);
  transition: transform 150ms ease;
}

.home-feature-card:hover .home-feature-action svg {
  transform: translate(2px, -2px);
}

@media (max-width: 700px) {
  .home-feature-card {
    padding: 21px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-feature-card,
  .home-feature-action svg {
    transition: none;
  }
}
</style>
