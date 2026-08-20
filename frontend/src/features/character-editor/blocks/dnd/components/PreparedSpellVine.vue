<template>
  <span
    class="prepared-spell-frame"
    :class="{ 'prepared-spell-frame-permanent': permanent }"
    aria-hidden="true"
  >
    <span class="prepared-spell-bracket prepared-spell-bracket-left" />
    <span class="prepared-spell-bracket prepared-spell-bracket-right" />
    <span class="prepared-spell-ornament prepared-spell-ornament-left" />
    <span class="prepared-spell-ornament prepared-spell-ornament-right" />
  </span>
</template>

<script setup>
defineProps({
  permanent: { type: Boolean, default: false },
})
</script>

<style scoped>
.prepared-spell-frame {
  --prepared-ornament: url('/static/spells/prepared-vine.png');
  display: block;
}

.prepared-spell-bracket {
  position: absolute;
  top: 0;
  bottom: 0;
  width: clamp(58px, 13%, 82px);
  border: 1px solid currentColor;
  border-right: 0;
  border-radius: 11px 0 0 11px;
  -webkit-mask-image: linear-gradient(to right, var(--text-1) 0 18%, transparent 92%);
  mask-image: linear-gradient(to right, var(--text-1) 0 18%, transparent 92%);
}

.prepared-spell-bracket::after {
  position: absolute;
  top: 28%;
  bottom: 28%;
  left: -1px;
  width: 3px;
  border-radius: 999px;
  background: currentColor;
  content: '';
}

.prepared-spell-bracket-left { left: 0; }
.prepared-spell-bracket-right { right: 0; transform: scaleX(-1); }

.prepared-spell-ornament {
  position: absolute;
  top: 3px;
  bottom: 3px;
  width: clamp(54px, 11%, 72px);
  display: block;
  background: currentColor;
  -webkit-mask-image: var(--prepared-ornament);
  mask-image: var(--prepared-ornament);
  -webkit-mask-position: right center;
  mask-position: right center;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-size: contain;
  mask-size: contain;
}

.prepared-spell-ornament-left {
  left: 6px;
  transform: scaleX(-1);
}

.prepared-spell-ornament-right { right: 6px; }

.prepared-spell-frame-permanent {
  --prepared-ornament: url('/static/spells/permanent-vine.png');
}

.prepared-spell-frame-permanent .prepared-spell-bracket {
  width: clamp(64px, 15%, 92px);
  border-width: 1.5px;
  border-right: 0;
}

.prepared-spell-frame-permanent .prepared-spell-bracket::after {
  width: 4px;
}

.prepared-spell-frame-permanent .prepared-spell-ornament {
  width: clamp(60px, 13%, 84px);
}
</style>
