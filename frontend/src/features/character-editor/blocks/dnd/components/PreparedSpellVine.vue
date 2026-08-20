<template>
  <span
    class="prepared-spell-vine"
    :class="{ 'prepared-spell-vine-permanent': permanent }"
    aria-hidden="true"
  />
</template>

<script setup>
defineProps({
  permanent: { type: Boolean, default: false },
})
</script>

<style scoped>
.prepared-spell-vine {
  display: block;
  background: currentColor;
  -webkit-mask-image: url('/static/spells/prepared-vine.png');
  mask-image: url('/static/spells/prepared-vine.png');
  -webkit-mask-position: right center;
  mask-position: right center;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
}

.prepared-spell-vine-permanent {
  -webkit-mask-image: url('/static/spells/permanent-vine.png');
  mask-image: url('/static/spells/permanent-vine.png');
}
</style>
