<template>
  <article class="detail-entry-card" :class="{ 'detail-entry-card--combat': tone === 'combat' }">
    <h3 class="detail-entry-card-title">{{ title }}</h3>
    <div class="detail-entry-card-body">
      <slot />
    </div>
  </article>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  tone: { type: String, default: 'accent' },
})
</script>

<style scoped>
.detail-entry-card {
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--text-on-accent) 2.5%, transparent);
}

.detail-entry-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 8px;
  color: color-mix(in srgb, var(--text-1) 82%, var(--text-muted));
  font-family: var(--font-ui);
  font-size: 16px;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: .01em;
}

.detail-entry-card-title::before {
  content: '';
  width: 2px;
  height: 14px;
  flex: 0 0 2px;
  border-radius: 2px;
  background: color-mix(in srgb, var(--accent-soft) 72%, var(--text-2));
  box-shadow: 0 0 8px color-mix(in srgb, var(--accent) 22%, transparent);
}

.detail-entry-card--combat .detail-entry-card-title::before {
  background: color-mix(in srgb, var(--danger) 58%, var(--accent));
  box-shadow: 0 0 8px color-mix(in srgb, var(--danger) 20%, transparent);
}

.detail-entry-card-body {
  color: color-mix(in srgb, var(--text-2) 88%, var(--text-muted));
  font-size: 13px;
  line-height: 1.6;
}
</style>
