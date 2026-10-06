<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 48 48"
    fill="none"
    aria-hidden="true"
  >
    <defs>
      <linearGradient
        :id="gradient"
        x1="6"
        y1="2"
        x2="43"
        y2="48"
        gradientUnits="userSpaceOnUse"
      >
        <stop :stop-color="colors[0]" />
        <stop offset="1" :stop-color="colors[1]" />
      </linearGradient>
    </defs>
    <rect
      x="1"
      y="1"
      width="46"
      height="46"
      rx="13"
      :fill="`url(#${gradient})`"
    />
    <path
      d="M7 13L24 4l17 9M7 35l17 9 17-9"
      :stroke="colors[2]"
      stroke-opacity=".3"
    />
    <g v-if="pack === 'lost-cave'">
      <path d="M7 34l4-15 8-9 13 2 9 11-1 11H7Z" fill="#528e9b" />
      <path
        d="M11 19l8-9 5 10-8 4-5-5ZM24 20l8-8 9 11-11 3-6-6Z"
        fill="#91c8c9"
      />
      <path d="M15 34l2-10 7-5 8 7 2 8H15Z" fill="#12313e" />
      <path d="M23 16l2 9 3-5-5-4ZM13 34l4-6 4 6" fill="#c1eef0" />
      <path
        d="M9 37h30M17 40h14"
        stroke="#76dce1"
        stroke-width="2"
        stroke-linecap="round"
      />
    </g>
    <g v-else-if="pack === 'ultimate-dungeon'">
      <path d="M10 37V21a14 14 0 0 1 28 0v16H10Z" fill="#e7bb76" />
      <path d="M17 37V22a7 7 0 0 1 14 0v15H17Z" fill="#352a32" />
      <path
        d="M24 8v7M13 13l5 5M35 13l-5 5M10 23h7M31 23h7M10 30h7M31 30h7"
        stroke="#a9764b"
        stroke-width="1.5"
      />
      <path d="M20 37v-7h8v7M7 40h34" stroke="#f7dba5" stroke-width="2" />
      <path
        d="M6 23v7M42 23v7"
        stroke="#ffb951"
        stroke-width="3"
        stroke-linecap="round"
      />
    </g>
    <g v-else-if="pack === 'toxic-sewer'">
      <path d="M9 12h16a10 10 0 0 1 10 10v10H23V24H9V12Z" fill="#90b59a" />
      <path d="M10 13h14a10 10 0 0 1 10 10" stroke="#d0dfb1" stroke-width="2" />
      <path d="M16 10v16M22 30h14v5H22Z" stroke="#375d50" stroke-width="2" />
      <path
        d="M29 35v3M10 39c6-4 10 3 15 0s9-2 14 0M14 43h22"
        stroke="#b7ed62"
        stroke-width="2.5"
        stroke-linecap="round"
      />
      <circle cx="11" cy="31" r="2" fill="#b7ed62" />
      <circle cx="38" cy="9" r="2" fill="#b7ed62" />
    </g>
    <g v-else>
      <path d="M8 29l16-9 16 9v6l-16 9-16-9v-6Z" fill="#5480b5" />
      <path d="M8 29l16 9 16-9-16-9-16 9Z" fill="#97b9e7" />
      <path d="M8 15l16-9 16 9v6l-16 9-16-9v-6Z" fill="#6295d2" />
      <path d="M8 15l16 9 16-9-16-9-16 9Z" fill="#c5dff7" />
      <path
        d="M24 24v6M24 38v6M16 11l16 9M16 20l16-9"
        stroke="#35567f"
        stroke-width="1.5"
      />
    </g>
  </svg>
</template>
<script setup>
import { computed, useId } from "vue";
const props = defineProps({
  pack: String,
  size: { type: Number, default: 40 },
});
const gradient = `map-pack-${useId()}`;
const colors = computed(
  () =>
    ({
      "lost-cave": ["#264959", "#15242f", "#9de6df"],
      "ultimate-dungeon": ["#654c43", "#302630", "#ffdb91"],
      "toxic-sewer": ["#355747", "#182f2a", "#b7ed62"],
    })[props.pack] || ["#334d76", "#1e2c46", "#a7d5ff"],
);
</script>
