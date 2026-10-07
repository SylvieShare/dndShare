export function rotateDoorPoint([x, y, z], spec) {
  const [hx, hy] = spec.hinge,
    a = (spec.angle * Math.PI) / 180;
  return [
    hx + Math.cos(a) * (x - hx) - Math.sin(a) * (y - hy),
    hy + Math.sin(a) * (x - hx) + Math.cos(a) * (y - hy),
    z,
  ];
}
const clip = (v) => Math.max(0, Math.min(1, v));
const rect = (x0, y0, x1, y1) => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];
export function openDoorModel(parent, spec) {
  if (
    !["UD-010", "UD-011"].includes(parent.sourceCode) ||
    spec.code !== parent.sourceCode + "-OPEN" ||
    spec.angle !== 90
  )
    throw new Error("Reviewed90 degree door recipe required");
  const points = [-spec.cut.radius, spec.cut.radius]
    .flatMap((y) => spec.cut.x.map((x) => rotateDoorPoint([x, y, 25], spec)))
    .map(([x, y]) => [clip(0.5 + x / 35), clip(0.5 - y / 35)]);
  const low = 0.5 - spec.cut.radius / 35,
    high = 0.5 + spec.cut.radius / 35;
  return {
    ...structuredClone(parent),
    id: "",
    sourceCode: spec.code,
    sourceName: spec.sourceName,
    name: spec.name,
    version: 1,
    textureDetail: "detailed",
    tags: [
      ...parent.tags,
      "door",
      "open",
      "derived:" + parent.sourceCode,
      "open-angle:90",
    ],
    assets: {},
    blockers: [
      rect(0.5 + spec.cut.x[0] / 35, 0, 1, low),
      rect(0.5 + spec.cut.x[0] / 35, high, 1, 1),
      rect(
        Math.min(...points.map((p) => p[0])),
        Math.min(...points.map((p) => p[1])),
        Math.max(...points.map((p) => p[0])),
        Math.max(...points.map((p) => p[1])),
      ),
    ],
  };
}
