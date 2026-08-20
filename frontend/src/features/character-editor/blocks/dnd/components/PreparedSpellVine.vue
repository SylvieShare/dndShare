<template>
  <svg
    class="prepared-spell-vine"
    viewBox="0 0 176 72"
    fill="none"
    preserveAspectRatio="xMaxYMid meet"
    aria-hidden="true"
  >
    <path class="vine-stem" d="M178 68c-30 0-22-22-50-22-24 0-15-22-42-22" />
    <path class="vine-stem" d="M176 51c-25 0-18-22-43-23-20-1-12-19-34-21" />
    <path class="vine-stem vine-stem-fine" d="M150 56c-16-7-23 2-31 12" />
    <path class="vine-stem vine-stem-fine" d="M139 32c-13 6-14 16-11 24" />
    <path class="vine-leaf" d="M151 56c-13-1-19 6-20 15 11 0 19-5 20-15Z" />
    <path class="vine-leaf" d="M137 31c7-10 16-11 23-7-4 9-12 13-23 7Z" />
    <path class="vine-leaf" d="M124 46c-10-8-19-6-24 0 7 8 15 9 24 0Z" />
    <path class="vine-leaf" d="M119 28c-9-8-17-6-22-1 6 7 14 9 22 1Z" />
    <path class="vine-leaf" d="M99 8c-7-7-14-6-18-1 5 6 11 8 18 1Z" />
    <path class="vine-leaf" d="M91 24c-5-9-13-12-20-8 2 8 9 12 20 8Z" />

    <g v-if="permanent" class="vine-crown">
      <path d="M170 13c-11 0-18 5-22 15 11 1 19-4 22-15Z" />
      <path d="M150 11c-7-8-15-9-22-4 4 8 12 10 22 4Z" />
      <path class="vine-stem" d="M173 4c-9 4-17 12-23 24" />
    </g>
  </svg>
</template>

<script setup>
defineProps({
  permanent: { type: Boolean, default: false },
})
</script>

<style scoped>
.prepared-spell-vine {
  display: block;
  width: 100%;
  height: 100%;
  color: inherit;
  overflow: visible;
}

.vine-stem {
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.vine-stem-fine { stroke-width: 1.25; }
.vine-leaf,
.vine-crown { fill: currentColor; }
</style>
