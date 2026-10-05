<template>
  <svg
    viewBox="0 0 32 32"
    width="30"
    height="30"
    fill="none"
    stroke="currentColor"
    stroke-width="1.4"
    stroke-linejoin="round"
    stroke-linecap="round"
    aria-hidden="true"
  >
    <g v-if="kind === 'all'">
      <path
        v-for="(p, i) in allTiles"
        :key="i"
        :d="p"
        class="tile-category-face"
      />
    </g>
    <g v-else>
      <path :d="base" class="tile-category-base" />
      <g v-for="(solid, index) in solids" :key="index">
        <path
          v-for="(face, side) in solid.sides"
          :key="side"
          :d="face"
          class="tile-category-side"
        />
        <path :d="solid.top" class="tile-category-face" />
      </g>
      <path v-if="kind === 'floor'" d="M11 19l4-2 3 2 4-2M15 17v-3" />
      <path
        v-if="kind === 'wall-none'"
        d="M8 14l16 12M24 14L8 26"
        stroke-width="2"
      />
      <g v-if="kind === 'frame'">
        <path
          v-for="(line, index) in frame"
          :key="index"
          :d="line"
          stroke-width="2"
        />
      </g>
      <path v-if="kind === 'prop'" d="M12 13l5 3 5-3M17 16v8" />
    </g>
  </svg>
</template>
<script setup>
import { computed } from "vue";
const props = defineProps({ kind: String });
const point = (x, y, z = 0) => [16 + (x - y) * 0.5, 15 + (x + y) * 0.25 - z];
const path = (points, close = true) =>
  points.map((p, i) => `${i ? "L" : "M"}${p.join(",")}`).join(" ") +
  (close ? "Z" : "");
const rectangle = (x1, y1, x2, y2) => [
  [x1, y1],
  [x2, y1],
  [x2, y2],
  [x1, y2],
];
function solid(polygon, height) {
  return {
    top: path(polygon.map(([x, y]) => point(x, y, height))),
    sides: polygon.map((p, i) => {
      const q = polygon[(i + 1) % polygon.length];
      return path([
        point(...p),
        point(...q),
        point(...q, height),
        point(...p, height),
      ]);
    }),
  };
}
const base = path(rectangle(1, 1, 25, 25).map((p) => point(...p)));
const allTiles = [
  rectangle(2, 2, 11, 11),
  rectangle(15, 2, 24, 11),
  rectangle(2, 15, 11, 24),
  rectangle(15, 15, 24, 24),
].map((p) => path(p.map((v) => point(...v))));
const shapes = {
  "wall-straight": [
    [3, 10],
    [23, 10],
    [23, 14],
    [3, 14],
  ],
  "wall-angle": [
    [3, 3],
    [7, 3],
    [7, 19],
    [23, 19],
    [23, 23],
    [3, 23],
  ],
  "wall-tee": [
    [3, 3],
    [23, 3],
    [23, 7],
    [15, 7],
    [15, 23],
    [11, 23],
    [11, 7],
    [3, 7],
  ],
  "wall-cross": [
    [11, 3],
    [15, 3],
    [15, 11],
    [23, 11],
    [23, 15],
    [15, 15],
    [15, 23],
    [11, 23],
    [11, 15],
    [3, 15],
    [3, 11],
    [11, 11],
  ],
  "wall-corner": [
    [10, 11],
    [16, 11],
    [16, 23],
    [10, 23],
  ],
  wall: [
    [3, 3],
    [23, 3],
    [23, 7],
    [7, 7],
    [7, 19],
    [23, 19],
    [23, 23],
    [3, 23],
  ],
};
const solids = computed(() => {
  if (props.kind === "floor") return [solid(rectangle(1, 1, 25, 25), 2)];
  if (shapes[props.kind]) return [solid(shapes[props.kind], 8)];
  if (props.kind === "wall-custom")
    return [
      solid(rectangle(3, 3, 10, 13), 9),
      solid(rectangle(14, 14, 23, 23), 6),
    ];
  if (props.kind === "stairs")
    return [
      solid(rectangle(3, 3, 23, 9), 3),
      solid(rectangle(3, 9, 23, 16), 6),
      solid(rectangle(3, 16, 23, 23), 9),
    ];
  if (props.kind === "prop") return [solid(rectangle(7, 7, 20, 20), 9)];
  return [];
});
const frame = [
  rectangle(3, 3, 23, 23).map((p) => point(...p, 9)),
  ...rectangle(3, 3, 23, 23).map((p) => [point(...p), point(...p, 9)]),
].map((p, i) => path(p, i === 0));
</script>
<style scoped>
.tile-category-base {
  fill: currentColor;
  fill-opacity: 0.06;
}
.tile-category-face {
  fill: currentColor;
  fill-opacity: 0.22;
}
.tile-category-side {
  fill: currentColor;
  fill-opacity: 0.1;
}
</style>
