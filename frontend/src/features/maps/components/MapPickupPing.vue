<template>
  <span
    v-if="point"
    :key="point.key"
    class="map-pickup-ping"
    :style="{ left: `${point.x}px`, top: `${point.y}px` }"
    aria-hidden="true"
    @animationend="emit('done')"
  />
</template>
<script setup>
defineProps({ point: Object });
const emit = defineEmits(["done"]);
</script>
<style scoped>
.map-pickup-ping {
  position: absolute;
  z-index: 4;
  width: 44px;
  height: 44px;
  margin: -22px;
  border: 2px solid var(--accent);
  border-radius: 50%;
  pointer-events: none;
  animation: map-pickup-ping 0.36s ease-out both;
}
@keyframes map-pickup-ping {
  from {
    opacity: 0.9;
    transform: scale(0.35);
  }
  to {
    opacity: 0;
    transform: scale(1.4);
  }
}
@media (prefers-reduced-motion: reduce) {
  .map-pickup-ping {
    animation-name: map-pickup-still;
    animation-duration: 0.2s;
  }
  @keyframes map-pickup-still {
    from {
      opacity: 0.8;
    }
    to {
      opacity: 0;
    }
  }
}
</style>
