<template>
  <section
    class="detail-section"
    :class="{
      'detail-section--collapsible': collapsible,
      'detail-section--open': open,
      'detail-section--illustrated': $slots.icon,
      'detail-section--combat': tone === 'combat',
    }"
  >
    <component
      :is="collapsible ? 'button' : 'div'"
      class="detail-section-head"
      :class="{ 'detail-section-head--btn': collapsible }"
      :type="collapsible ? 'button' : null"
      @click="collapsible && (open = !open)"
    >
      <span v-if="$slots.icon" class="detail-section-icon" aria-hidden="true">
        <slot name="icon" />
      </span>
      <span class="detail-section-label">{{ label }}</span>
      <span v-if="$slots.icon" class="detail-section-rule" aria-hidden="true"></span>
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
  tone: { type: String, default: 'accent' },
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

.detail-section--illustrated {
  margin-top: 24px;
}

.detail-section--illustrated .detail-section-head {
  justify-content: flex-start;
  gap: 9px;
  margin-bottom: 11px;
}

.detail-section-icon {
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  display: grid;
  place-items: center;
  box-sizing: border-box;
  border: 1px solid color-mix(in srgb, var(--accent-soft) 52%, var(--border));
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent) 11%, var(--surface));
  color: var(--accent-soft);
  box-shadow: inset 0 0 14px color-mix(in srgb, var(--accent) 8%, transparent);
}

.detail-section-icon :deep(svg) {
  width: 15px;
  height: 15px;
  stroke-width: 1.8;
}

.detail-section--illustrated .detail-section-label {
  flex: 0 1 auto;
  padding-bottom: 0;
  border-bottom: 0;
  color: var(--text-1);
  font-size: 14px;
  font-weight: 800;
  letter-spacing: .13em;
  text-shadow: 0 1px 8px color-mix(in srgb, var(--scrim) 45%, transparent);
  white-space: nowrap;
}

.detail-section-rule {
  min-width: 20px;
  height: 1px;
  flex: 1;
  background: linear-gradient(90deg,
    color-mix(in srgb, var(--accent-soft) 56%, var(--border)),
    color-mix(in srgb, var(--border) 72%, transparent) 55%,
    transparent);
}

.detail-section--combat .detail-section-icon {
  border-color: color-mix(in srgb, var(--danger) 54%, var(--accent));
  background: color-mix(in srgb, var(--danger) 10%, var(--surface));
  color: color-mix(in srgb, var(--danger) 68%, var(--text-on-accent));
  box-shadow: inset 0 0 14px color-mix(in srgb, var(--danger) 9%, transparent);
}

.detail-section--combat .detail-section-rule {
  background: linear-gradient(90deg,
    color-mix(in srgb, var(--danger) 55%, var(--accent)),
    color-mix(in srgb, var(--border) 72%, transparent) 55%,
    transparent);
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
