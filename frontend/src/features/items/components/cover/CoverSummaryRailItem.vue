<template>
  <div class="cover-summary-rail-item">
    <div class="cover-summary-rail-copy">
      <small>{{ label }}</small>
      <div><slot /></div>
    </div>
    <component :is="icon" v-if="icon" class="cover-summary-rail-mark" aria-hidden="true" />
  </div>
</template>

<script setup>
defineProps({
  icon: { type: [Object, Function], default: null },
  label: { type: String, required: true },
})
</script>

<style scoped>
.cover-summary-rail-item {
  position: relative;
  min-width: 0;
  min-height: 42px;
  display: flex;
  align-items: center;
  padding: 3px 40px 3px 12px;
  color: var(--text-on-accent);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.3;
  box-sizing: border-box;
}

.cover-summary-rail-copy { min-width: 0; }
.cover-summary-rail-copy > div { overflow-wrap: anywhere; }

.cover-summary-rail-item small {
  display: block;
  margin-bottom: 2px;
  color: color-mix(in srgb, var(--text-on-accent) 54%, transparent);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: .1em;
  text-transform: uppercase;
}

.cover-summary-rail-mark {
  position: absolute;
  top: 50%;
  right: 12px;
  width: 24px;
  height: 24px;
  color: color-mix(in srgb, var(--accent) 68%, var(--text-on-accent));
  opacity: .88;
  pointer-events: none;
  transform: translateY(-50%);
}

@media (max-width: 520px) {
  .cover-summary-rail-item { min-height: 40px; padding: 5px 38px 5px 10px; }
  .cover-summary-rail-mark { right: 10px; width: 22px; height: 22px; }
}
</style>
