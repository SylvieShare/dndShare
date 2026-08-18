<template>
  <section class="detail-section" :class="{ 'detail-section--collapsible': collapsible, 'detail-section--open': open }">
    <component
      :is="collapsible ? 'button' : 'div'"
      class="detail-section-head"
      :class="{ 'detail-section-head--btn': collapsible }"
      :type="collapsible ? 'button' : null"
      @click="collapsible && (open = !open)"
    >
      <span class="detail-section-label">{{ label }}</span>
      <svg
        v-if="collapsible"
        class="detail-section-chevron"
        viewBox="0 0 16 16"
        fill="none"
        width="14"
        height="14"
      >
        <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </component>
    <div v-show="!collapsible || open" class="detail-section-body">
      <slot />
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  collapsible: { type: Boolean, default: false },
  defaultOpen: { type: Boolean, default: true },
})

const open = ref(props.defaultOpen)
</script>

<style scoped>
.detail-section {
  margin-top: 18px;
}

.detail-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 0;
  margin-bottom: 8px;
  background: none;
  border: none;
  text-align: left;
  font: inherit;
  color: var(--text-1);
}

.detail-section-head--btn {
  cursor: pointer;
  transition: color 0.12s;
}
.detail-section-head--btn:hover .detail-section-label {
  color: var(--text-on-accent);
}

.detail-section-label {
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--text-2);
  text-transform: uppercase;
  border-bottom: 1px solid color-mix(in srgb, var(--text-2) 30%, transparent);
  padding-bottom: 4px;
  flex: 1;
  min-width: 0;
}

.detail-section-chevron {
  color: var(--text-2);
  flex-shrink: 0;
  transition: transform 0.18s;
  margin-bottom: 4px;
}
.detail-section--open .detail-section-chevron {
  transform: rotate(180deg);
}

.detail-section-body {
  /* host-provided content */
}
</style>
