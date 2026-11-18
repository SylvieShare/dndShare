<template>
  <span class="defeated-mark" role="img" aria-label="Существо повержено">
    <Skull class="defeated-skull" :size="21" aria-hidden="true" />
    <Bone class="defeated-bone" :size="23" aria-hidden="true" />
    <Bone class="defeated-bone defeated-bone--cross" :size="23" aria-hidden="true" />
  </span>
</template>

<script setup>
import { Bone, Skull } from '@lucide/vue'
</script>

<style scoped>
.defeated-mark {
  position: relative;
  display: inline-block;
  flex: none;
  inline-size: 26px;
  block-size: 28px;
  color: color-mix(in srgb, var(--danger) 36%, var(--text-1));
}
.defeated-skull { position: absolute; inset: 0 auto auto 50%; translate: -50% 0; }
.defeated-bone { position: absolute; inset: 9px auto auto 50%; translate: -50% 0; scale: 1 .45; }
.defeated-bone--cross { transform: scaleX(-1); }
</style>
