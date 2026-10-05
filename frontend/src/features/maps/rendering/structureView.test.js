import { expect, it } from "vitest";
import { Raycaster, Vector3 } from "three";
import { structureView } from "./structureView";
const models = [
  {
    id: "frame",
    width: 2,
    height: 1,
    supportSlots: [{ x: 0, y: 0, width: 2, height: 1, elevation: 0.6 }],
  },
  { id: "floor", width: 1, height: 1 },
  { id: "bridge", width: 3, height: 1 },
];
const base = {
  id: "base",
  modelId: "frame",
  x: 1,
  y: 1,
  rotation: 0,
  level: 0,
};
function setup(tiles) {
  const view = structureView(
    {
      catalogue: () => models,
      metadata: (id) => models.find((m) => m.id === id),
    },
    {
      world: ({ x, y }) => ({ x, y }),
      ray: ({ x, y }) =>
        new Raycaster(new Vector3(x, 10, y), new Vector3(0, -1, 0)),
    },
  );
  view.update({ width: 8, height: 8, tiles });
  return view;
}
it("detects upper sockets without a selected level and drops to ground away from them", () => {
  const view = setup([base]);
  expect(view.point({ x: 1.5, y: 1.5 }, "floor")).toMatchObject({
    level: 1,
    elevation: 0.6,
  });
  expect(view.point({ x: 5.5, y: 5.5 }, "floor")).toMatchObject({ level: 0 });
});
it("prefers the closest upper socket and ignores the entire moving stack", () => {
  const upper = { ...base, id: "upper", level: 1 };
  const view = setup([upper, base]);
  expect(view.point({ x: 1.5, y: 1.5 }, "floor")).toMatchObject({
    level: 2,
    elevation: 1.2,
  });
  expect(
    view.point({ x: 1.5, y: 1.5 }, "frame", { tileIds: ["base", "upper"] }),
  ).toMatchObject({ level: 0 });
});
it("detects a support under the end of a bridge while its centre is in the air", () => {
  const view = setup([base]);
  expect(view.point({ x: 3.5, y: 1.5 }, "bridge")).toMatchObject({
    level: 1,
    elevation: 0.6,
  });
});
it("uses the bottom member of a dragged stack when it is grabbed by an upper tile", () => {
  const view = setup([base]);
  const point = view.point({ x: 1.5, y: 1.5 }, "floor", {
    levelOffset: 1,
    grabHeight: 1,
    supportBounds: { x: 0, y: 0, width: 2, height: 1 },
  });
  expect(point).toMatchObject({ level: 2 });
  expect(
    view.point({ x: 5.5, y: 5.5 }, "floor", { levelOffset: 1, grabHeight: 1 }),
  ).toMatchObject({ level: 1 });
});
