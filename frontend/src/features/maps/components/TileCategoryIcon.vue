<template>
  <svg
    :class="{ 'tile-category-icon--selected': selected }"
    viewBox="0 0 32 32"
    width="30"
    height="30"
    fill="none"
    stroke="currentColor"
    stroke-width="1.1"
    stroke-linejoin="round"
    stroke-linecap="round"
    aria-hidden="true"
  >
    <g>
      <path v-if="kind !== 'floor'" :d="base" class="tile-category-base" />
      <g v-for="(solid, index) in solids" :key="index">
        <path
          v-for="(face, side) in solid.sides"
          :key="side"
          :d="face.path"
          :class="`tile-category-side-${face.axis}`"
        />
        <path :d="solid.top" class="tile-category-face" fill-rule="evenodd" />
      </g>
      <path v-if="kind === 'floor'" :d="floorJoints" />
    </g>
  </svg>
</template>
<script setup>
import { computed } from "vue";
const props = defineProps({ kind: String, selected: Boolean });
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
function solid(polygon, height, bottom = 0) {
  return {
    depth: polygon.reduce((sum, [x, y]) => sum + x + y, 0) / polygon.length,
    top: path(polygon.map(([x, y]) => point(x, y, height))),
    sides: polygon
      .flatMap((p, i) => {
        const q = polygon[(i + 1) % polygon.length];
        // The camera faces +X/+Y; omit edges whose outward normal faces away.
        if (q[0] - p[0] <= q[1] - p[1]) return [];
        return [
          {
            depth: p[0] + p[1] + q[0] + q[1],
            axis: p[0] === q[0] ? "x" : "y",
            path: path([
              point(...p, bottom),
              point(...q, bottom),
              point(...q, height),
              point(...p, height),
            ]),
          },
        ];
      })
      .sort((a, b) => a.depth - b.depth),
  };
}
const base = path(rectangle(1, 1, 25, 25).map((p) => point(...p)));
const floorJoints = [
  [
    [1, 13],
    [25, 13],
  ],
  [
    [13, 1],
    [13, 25],
  ],
]
  .map((line) =>
    path(
      line.map((p) => point(...p, 2)),
      false,
    ),
  )
  .join(" ");
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
function modelSolids(kind) {
  if (kind === "floor") return [solid(rectangle(1, 1, 25, 25), 2)];
  if (shapes[kind]) return [solid(shapes[kind], 8)];
  if (kind === "wall-custom")
    return [
      solid(rectangle(3, 3, 10, 13), 9),
      solid(rectangle(14, 14, 23, 23), 6),
    ];
  if (kind === "stairs")
    return [
      solid(rectangle(3, 3, 23, 9), 9),
      solid(rectangle(3, 9, 23, 16), 6),
      solid(rectangle(3, 16, 23, 23), 3),
    ];
  if (kind === "frame") {
    const roof = solid(rectangle(3, 3, 23, 23), 10, 8);
    const opening = solid(rectangle(7, 7, 19, 19).reverse(), 10, 8);
    roof.top += opening.top;
    roof.sides.push(...opening.sides);
    roof.sides.sort((a, b) => a.depth - b.depth);
    roof.depth = Infinity;
    return [
      ...[
        [3, 3],
        [19, 3],
        [3, 19],
        [19, 19],
      ].map(([x, y]) => solid(rectangle(x, y, x + 4, y + 4), 8)),
      roof,
    ];
  }
  if (kind === "prop") return [solid(rectangle(7, 7, 20, 20), 9)];
  return [];
}
const solids = computed(() =>
  modelSolids(props.kind).sort((a, b) => a.depth - b.depth),
);
</script>
<style scoped>
svg {
  --tile-icon-surface: var(--surface);
}
.tile-category-icon--selected {
  --tile-icon-surface: var(--accent);
}
.tile-category-base {
  fill: color-mix(in srgb, currentColor 12%, var(--tile-icon-surface));
}
.tile-category-face {
  fill: color-mix(in srgb, currentColor 58%, var(--tile-icon-surface));
}
.tile-category-side-x {
  fill: color-mix(in srgb, currentColor 20%, var(--tile-icon-surface));
}
.tile-category-side-y {
  fill: color-mix(in srgb, currentColor 36%, var(--tile-icon-surface));
}
</style>
