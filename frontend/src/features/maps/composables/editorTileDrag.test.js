import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { clone, newMap } from "../lib/mapModel";
import { editorTileDrag } from "./editorTileDrag";
import { editorGestures } from "./editorGestures";

function setup(tiles = []) {
  const source = newMap();
  source.document.width = source.document.height = 8;
  source.document.tiles = clone(tiles);
  const e = Object.fromEntries(
    Object.entries({
      draft: source,
      catalogue: [
        { id: "floor", width: 1, height: 1 },
        { id: "wide", width: 2, height: 1 },
        {
          id: "frame",
          width: 2,
          height: 1,
          supportSlots: [{ x: 0, y: 0, width: 2, height: 1, elevation: 0.6 }],
        },
      ],
      tool: "select",
      selectedModel: "floor",
      placementRotation: 0,
      level: 0,
      hoveredTile: "",
      selectedTile: "",
      selectedTiles: [],
      screenSelection: null,
      selectedObject: "",
      selectedObjects: [],
      selectedZone: "",
      selection: null,
      previewTile: null,
      draggingTile: false,
      error: "",
      history: [],
      future: [],
    }).map(([key, value]) => [key, ref(value)]),
  );
  e.pauseSave = vi.fn();
  e.setTileSelection = (ids, primary = ids[0] || "") => {
    e.selectedTiles.value = [...new Set(ids)];
    e.selectedTile.value = primary;
  };
  e.setObjectSelection = (ids) => {
    e.selectedObjects.value = [...new Set(ids)];
    e.selectedObject.value = ids[0] || "";
  };
  e.checkpoint = () => {
    e.history.value.push(clone(e.draft.value));
    e.future.value = [];
  };
  e.change = (fn) => {
    e.checkpoint();
    fn(e.draft.value);
  };
  e.tileDrag = editorTileDrag(e);
  e.gestures = editorGestures(e);
  return e;
}
const tile = {
  id: "placed",
  modelId: "floor",
  x: 2,
  y: 2,
  rotation: 0,
  level: 0,
};

describe("tile dragging", () => {
  it("moves between socket and ground levels using cursor candidates rather than an editor mode", () => {
    const frame = { ...tile, id: "frame", modelId: "frame", x: 4, y: 4 };
    const e = setup([tile, frame]);
    e.tileDrag.begin("floor", { x: 2.2, y: 2.4, elevation: 0.4 }, tile);
    e.tileDrag.move({
      x: 4.2,
      y: 4.4,
      candidates: [
        { x: 4.2, y: 4.4, level: 1 },
        { x: 4.2, y: 4.4, level: 0 },
      ],
    });
    expect(e.previewTile.value).toMatchObject({ level: 1, valid: true });
    e.tileDrag.drop({ x: 4.2, y: 4.4, level: 1 });
    expect(e.draft.value.document.tiles[0]).toMatchObject({
      x: 4,
      y: 4,
      level: 1,
    });
    const above = e.draft.value.document.tiles[0];
    e.tileDrag.begin("floor", { x: 4.2, y: 4.4, elevation: 1 }, above);
    e.tileDrag.drop({ x: 2.2, y: 2.4, level: 0 });
    expect(e.draft.value.document.tiles[0]).toMatchObject({
      x: 2,
      y: 2,
      level: 0,
    });
  });
  it("raises a frame together with its dependent tiles and keeps their relative levels", () => {
    const base = { ...tile, modelId: "frame" },
      child = { ...tile, id: "child", level: 1 };
    const receiver = { ...base, id: "receiver", x: 4, y: 4 };
    const e = setup([base, child, receiver]);
    e.tileDrag.begin("frame", { x: 2.2, y: 2.4, elevation: 0.6 }, base);
    e.tileDrag.drop({ x: 4.2, y: 4.4, level: 1 });
    expect(e.draft.value.document.tiles.slice(0, 2)).toMatchObject([
      { x: 4, y: 4, level: 1 },
      { x: 4, y: 4, level: 2 },
    ]);
    expect(e.history.value).toHaveLength(1);
  });
  it("previews magnetic anchors without committing the dragged model", () => {
    const e = setup();
    e.tileDrag.begin("floor");
    e.tileDrag.move({ x: 3.27, y: 4.64 });
    expect(e.previewTile.value.x).toBe(3);
    expect(e.previewTile.value.y).toBe(4);
    expect(e.draft.value.document.tiles).toEqual([]);
    expect(e.history.value).toEqual([]);
    e.tileDrag.drop({ x: 3.27, y: 4.64 });
    expect(e.draft.value.document.tiles[0]).toMatchObject({
      x: 3,
      y: 4,
      modelId: "floor",
    });
    expect(e.history.value).toHaveLength(1);
    expect(e.previewTile.value).toBeNull();
  });
  it("rotates the active preview with R before committing it", () => {
    const e = setup();
    e.tileDrag.begin("wide");
    e.tileDrag.move({ x: 3.5, y: 4.5 });
    e.gestures.rotate();
    expect(e.previewTile.value.rotation).toBe(90);
    e.tileDrag.drop({ x: 3.5, y: 4.5 });
    expect(e.draft.value.document.tiles[0]).toMatchObject({
      x: 3,
      y: 4,
      rotation: 90,
    });
  });
  it("cancels without changing history or the original document", () => {
    const e = setup([tile]);
    e.tileDrag.begin("floor", { x: 2.2, y: 2.4 }, tile);
    e.tileDrag.move({ x: 5.7, y: 6.8 });
    e.tileDrag.cancel();
    expect(e.draft.value.document.tiles).toEqual([tile]);
    expect(e.history.value).toEqual([]);
    expect(e.draggingTile.value).toBe(false);
  });
  it("preserves the grabbed offset while moving an existing tile", () => {
    const e = setup([tile]);
    e.tileDrag.begin("floor", { x: 2.2, y: 2.4 }, tile);
    e.tileDrag.move({ x: 5.2, y: 4.4 });
    expect(e.previewTile.value).toMatchObject({ x: 5, y: 4, tileId: "placed" });
    expect(e.draft.value.document.tiles).toEqual([tile]);
    e.tileDrag.drop({ x: 5.2, y: 4.4 });
    expect(e.draft.value.document.tiles[0]).toEqual({ ...tile, x: 5, y: 4 });
  });
  it("magnetizes to a free cell beside a rotated wide model", () => {
    const e = setup([{ ...tile, modelId: "wide", rotation: 90 }]);
    e.tileDrag.begin("floor");
    e.tileDrag.move({ x: 2.5, y: 3.5 });
    expect(e.previewTile.value.valid).toBe(true);
    e.tileDrag.drop({ x: 2.5, y: 3.5 });
    expect(e.draft.value.document.tiles).toHaveLength(2);
    expect(e.draft.value.document.tiles[0]).toEqual({
      ...tile,
      modelId: "wide",
      rotation: 90,
    });
    expect(e.history.value).toHaveLength(1);
  });
  it("ignores an outside drop instead of creating or deleting a tile", () => {
    const e = setup([tile]);
    e.tileDrag.begin("floor");
    e.tileDrag.drop(null);
    expect(e.draft.value.document.tiles).toEqual([tile]);
    e.tileDrag.begin("wide");
    e.tileDrag.drop({ x: 15.5, y: 15.5 });
    expect(e.draft.value.document.tiles).toEqual([tile]);
    expect(e.error.value).toContain("границу");
  });
  it("selects by the geometry hit without treating the whole grid cell as a tile", () => {
    const e = setup([tile]);
    e.gestures.handle({ phase: "hover", hit: { tileId: tile.id } });
    expect(e.hoveredTile.value).toBe(tile.id);
    e.gestures.handle({ phase: "start", point: { x: 2.5, y: 2.5 }, hit: null });
    e.gestures.handle({ phase: "end", point: { x: 2.5, y: 2.5 } });
    expect(e.selectedTile.value).toBe("");
    expect(e.history.value).toEqual([]);
    e.gestures.handle({
      phase: "start",
      point: { x: 2.5, y: 2.5 },
      hit: { tileId: tile.id },
    });
    e.gestures.handle({ phase: "end", point: { x: 2.5, y: 2.5 } });
    expect(e.selectedTile.value).toBe(tile.id);
    expect(e.history.value).toEqual([]);
  });
  it("moves a selected tile after the drag threshold and commits once", () => {
    const e = setup([tile]);
    e.gestures.handle({
      phase: "start",
      point: { x: 2.2, y: 2.4 },
      hit: { tileId: tile.id },
    });
    e.gestures.handle({ phase: "move", point: { x: 2.21, y: 2.41 } });
    expect(e.draggingTile.value).toBe(false);
    e.gestures.handle({ phase: "move", point: { x: 4.2, y: 3.4 } });
    expect(e.draggingTile.value).toBe(true);
    expect(e.draft.value.document.tiles).toEqual([tile]);
    e.gestures.handle({ phase: "end", point: { x: 4.2, y: 3.4 } });
    expect(e.draft.value.document.tiles[0]).toEqual({ ...tile, x: 4, y: 3 });
    expect(e.history.value).toHaveLength(1);
  });
  it("toggles command clicks and adds a dragged region to the selection", () => {
    const other = { ...tile, id: "other", x: 4 };
    const e = setup([tile, other]);
    e.setTileSelection([tile.id]);
    const start = (id) =>
      e.gestures.handle({
        phase: "start",
        point: { x: 4.5, y: 2.5 },
        hit: { tileId: id },
        event: { metaKey: true, clientX: 50, clientY: 50 },
      });
    start(other.id);
    e.gestures.handle({ phase: "end", point: { x: 4.5, y: 2.5 } });
    expect(e.selectedTiles.value).toEqual([tile.id, other.id]);
    start(other.id);
    e.gestures.handle({ phase: "end", point: { x: 4.5, y: 2.5 } });
    expect(e.selectedTiles.value).toEqual([tile.id]);
    e.gestures.handle({
      phase: "start",
      point: { x: 3.5, y: 1.5 },
      event: { metaKey: true, clientX: 10, clientY: 10 },
    });
    e.gestures.handle({
      phase: "move",
      point: { x: 5.5, y: 3.5 },
      event: { clientX: 70, clientY: 70 },
      screenRect: { left: 10, top: 10, width: 60, height: 60 },
      regionTiles: [other.id],
    });
    e.gestures.handle({ phase: "end", point: { x: 5.5, y: 3.5 } });
    expect(e.selectedTiles.value).toEqual([tile.id, other.id]);
    expect(e.history.value).toEqual([]);
  });
  it("magnetizes a group atomically without overlapping obstacles", () => {
    const other = { ...tile, id: "other", x: 4 };
    const obstacle = { ...tile, id: "obstacle", x: 6, y: 5 };
    const e = setup([tile, other, obstacle]);
    e.setTileSelection([tile.id, other.id]);
    e.tileDrag.begin("floor", { x: 2.5, y: 2.5 }, tile);
    e.tileDrag.drop({ x: 4.5, y: 5.5 });
    expect(e.draft.value.document.tiles.slice(0, 2)).toEqual([
      { ...tile, x: 4, y: 4 },
      { ...other, x: 6, y: 4 },
    ]);
    expect(e.history.value).toHaveLength(1);
    e.gestures.removeSelected();
    expect(e.draft.value.document.tiles).toEqual([obstacle]);
  });
});

it("rotates a selected assembly about a shared pivot and keeps a dragged group's pivot fixed", () => {
  const second = { ...tile, id: "second", x: 4 };
  const e = setup([tile, second]);
  e.setTileSelection([tile.id, second.id]);
  e.gestures.rotate();
  expect(e.draft.value.document.tiles).toMatchObject([
    { x: 3, y: 1, rotation: 90 },
    { x: 3, y: 3, rotation: 90 },
  ]);
  for (let i = 0; i < 3; i++) e.gestures.rotate();
  expect(e.draft.value.document.tiles).toEqual([tile, second]);
  e.tileDrag.begin("floor", { x: 2.5, y: 2.5 }, tile);
  e.tileDrag.move({ x: 3.5, y: 4.5 });
  e.gestures.rotate();
  expect(e.previewTile.value.group).toMatchObject([
    { x: 4, y: 3, rotation: 90 },
    { x: 4, y: 5, rotation: 90 },
  ]);
  expect(e.draft.value.document.tiles).toEqual([tile, second]);
  e.tileDrag.cancel();
});
it("rotates a supporting frame with dependent tiles and rejects a blocked turn atomically", () => {
  const base = { ...tile, id: "base", modelId: "frame" };
  const child = { ...tile, id: "child", level: 1 };
  const e = setup([base, child]);
  e.setTileSelection([base.id]);
  e.gestures.rotate();
  expect(e.draft.value.document.tiles).toMatchObject([
    { x: 3, y: 2, rotation: 90 },
    { x: 3, y: 2, level: 1, rotation: 90 },
  ]);
  expect(e.history.value).toHaveLength(1);
  const second = { ...tile, id: "second", x: 4 };
  const blocker = { ...tile, id: "blocker", x: 3, y: 1 };
  const blocked = setup([tile, second, blocker]);
  blocked.setTileSelection([tile.id, second.id]);
  blocked.gestures.rotate();
  expect(blocked.draft.value.document.tiles).toEqual([tile, second, blocker]);
  expect(blocked.history.value).toHaveLength(0);
  expect(blocked.error.value).toContain("уже есть");
});

it("a hold lifts without motion and moving a rotated tile carries its attached object in one undo", () => {
  const e = setup([tile]);
  e.catalogue.value[0].placementPoints = [{ x: 0.25, y: 0.5, elevation: 0.4 }];
  const object = {
    id: "chest",
    x: 2.25,
    y: 2.5,
    rotation: 30,
    placement: { tileId: tile.id, point: 0 },
  };
  e.draft.value.document.objects = [object];
  e.gestures.handle({
    phase: "start",
    point: { x: 2.2, y: 2.4 },
    hit: { tileId: tile.id },
  });
  e.gestures.handle({ phase: "hold" });
  expect(e.draggingTile.value).toBe(true);
  expect(e.previewTile.value.tileId).toBe(tile.id);
  e.tileDrag.move({ x: 5.2, y: 4.4 });
  e.tileDrag.rotate();
  expect(e.draft.value.document.objects[0]).toEqual(object);
  e.tileDrag.drop({ x: 5.2, y: 4.4 });
  expect(e.draft.value.document.objects[0]).toMatchObject({
    x: 5.5,
    y: 4.25,
    rotation: 120,
    placement: object.placement,
  });
  expect(e.history.value).toHaveLength(1);
  expect(e.history.value[0].document.objects[0]).toMatchObject({
    x: 2.25,
    y: 2.5,
    rotation: 30,
  });
});
