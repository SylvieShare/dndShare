<template>
  <span
    class="participant-color-ticks"
    :style="{ '--participant-color': color }"
    aria-hidden="true"
  >
    <span class="participant-color-tick" />
    <span class="participant-color-tick" />
  </span>
</template>

<script setup>
defineProps({
  color: { type: String, required: true },
})
</script>

<style scoped>
.participant-color-ticks {
  display: inline-flex;
  align-self: flex-start;
  flex: 0 0 auto;
  gap: 6px;
  height: 16px;
  margin-left: 3px;
  transform: translateY(-10px);
  pointer-events: none;
}

.participant-color-tick {
  width: 5px;
  height: 16px;
  background: var(--participant-color);
}
</style>
