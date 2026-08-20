<template>
  <span
    class="prepared-spell-brackets"
    :class="{ 'prepared-spell-brackets-permanent': permanent }"
    aria-hidden="true"
  >
    <span class="prepared-spell-bracket prepared-spell-bracket-left" />
    <span class="prepared-spell-bracket prepared-spell-bracket-right" />
  </span>
</template>

<script setup>
defineProps({
  permanent: { type: Boolean, default: false },
})
</script>

<style scoped>
.prepared-spell-brackets { display: block; }

.prepared-spell-bracket {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 13px;
  border: 1px solid currentColor;
  border-right: 0;
  border-radius: 11px 0 0 11px;
}

.prepared-spell-bracket::after {
  position: absolute;
  top: 30%;
  bottom: 30%;
  left: -1px;
  width: 3px;
  border-radius: 999px;
  background: currentColor;
  content: '';
}

.prepared-spell-bracket-left { left: 0; }
.prepared-spell-bracket-right { right: 0; transform: scaleX(-1); }

.prepared-spell-brackets-permanent .prepared-spell-bracket {
  width: 15px;
  border-width: 1.5px;
  border-right: 0;
}

.prepared-spell-brackets-permanent .prepared-spell-bracket::after {
  width: 4px;
}
</style>
