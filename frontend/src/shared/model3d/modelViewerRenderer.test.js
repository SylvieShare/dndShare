import { afterEach, expect, it, vi } from "vitest";
import { Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import { composeModelPreview, createModelViewer } from "./modelViewerRenderer";

const fake = vi.hoisted(() => ({ load: vi.fn(), release: vi.fn() }));
vi.mock("./modelLoader", () => ({ acquireModelLoader: () => fake }));
vi.mock("./modelOrbitControls", () => ({ modelOrbitControls: () => () => {} }));
vi.mock("three", async (original) => ({
  ...(await original()),
  WebGLRenderer: class {
    domElement = { remove: vi.fn() };
    setPixelRatio() {}
    setSize() {}
    dispose() {}
    forceContextLoss() {}
  },
}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mesh(width, height, depth) {
  const root = new Group(),
    part = new Mesh(
      new BoxGeometry(width, height, depth),
      new MeshBasicMaterial(),
    );
  part.position.y = height / 2;
  root.add(part);
  return root;
}
function viewer() {
  vi.stubGlobal("requestAnimationFrame", () => 1);
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  return createModelViewer({
    append() {},
    clientWidth: 300,
    clientHeight: 500,
  });
}
const metadata = {
  renderUrl: "/body",
  size: 1,
  referenceDiameter: 0.9,
  assetBytes: { render: 123 },
  base: {
    referenceDiameter: 0.9,
    renderUrl: "/base",
    assetBytes: { render: 45 },
    surfaceHeight: 0.06,
  },
};

it("places native feet on the base surface and fits both without changing GLB transforms", () => {
  const body = mesh(0.4, 1.2, 0.3),
    base = mesh(0.9, 0.06, 0.9);
  const detail = body.children[0];
  detail.scale.set(0.7, 1, 0.8);
  detail.rotation.y = 0.3;
  body.updateMatrixWorld(true);
  const native = detail.matrix.clone();
  const root = composeModelPreview(body, base, metadata);
  const feet = new Box3().setFromObject(body).min.y;
  expect(feet).toBeCloseTo(new Box3().setFromObject(base).max.y);
  const bounds = new Box3().setFromObject(root);
  expect(bounds.min.y).toBeCloseTo(0);
  expect(bounds.max.y).toBeCloseTo((1.2 * 0.7) / 0.9 + 0.06);
  expect(bounds.max.x - bounds.min.x).toBeCloseTo(0.7);
  expect(detail.matrix.equals(native)).toBe(true);
  expect(body.position.y).toBe(0);
  root.traverse((node) => {
    node.geometry?.dispose();
    node.material?.dispose();
  });
});

it("loads body and base together and releases both on closing the viewer", async () => {
  const body = mesh(0.4, 1, 0.3),
    base = mesh(0.9, 0.06, 0.9);
  const disposed = [body, base].map((root) =>
    vi.spyOn(root.children[0].geometry, "dispose"),
  );
  fake.load.mockImplementation(async (url) => ({
    scene: url === "/body" ? body : base,
  }));
  const render = viewer();
  await render.load(metadata);
  expect(fake.load).toHaveBeenCalledWith(
    "/base",
    expect.any(Function),
    undefined,
    undefined,
    45,
  );
  render.destroy();
  for (const dispose of disposed) expect(dispose).toHaveBeenCalledTimes(1);
});

it("uses a large creature's footprint and allows weapon overhang without shrinking the figure", () => {
  const body = mesh(2.4, 1.2, 0.3),
    base = mesh(1.8, 0.06, 1.8);
  const root = composeModelPreview(body, base, {
    ...metadata,
    size: 2,
    base: { ...metadata.base, referenceDiameter: 1.8 },
  });
  expect(body.parent.scale.x).toBeCloseTo(1.7 / 0.9);
  const baseBounds = new Box3().setFromObject(base);
  expect(baseBounds.max.x - baseBounds.min.x).toBeCloseTo(1.7);
  expect(baseBounds.max.y).toBeCloseTo(0.06);
  expect(new Box3().setFromObject(body).min.y).toBeCloseTo(0.06);
  expect(new Box3().setFromObject(root).max.x).toBeGreaterThan(
    baseBounds.max.x,
  );
  root.traverse((n) => {
    n.geometry?.dispose();
    n.material?.dispose();
  });
});

it.each(["failure", "close"])(
  "releases a successful late body when the base has a %s",
  async (mode) => {
    const body = mesh(0.4, 1, 0.3),
      base = mesh(0.9, 0.06, 0.9);
    const disposed = vi.spyOn(body.children[0].geometry, "dispose");
    let finish;
    fake.load.mockImplementation((url) =>
      url === "/body"
        ? new Promise((resolve) => {
            finish = () => resolve({ scene: body });
          })
        : mode === "failure"
          ? Promise.reject(new Error("base failed"))
          : Promise.resolve({ scene: base }),
    );
    const render = viewer(),
      pending = render.load(metadata);
    if (mode === "close") render.destroy();
    finish();
    if (mode === "failure")
      await expect(pending).rejects.toThrow("base failed");
    else await pending;
    expect(disposed).toHaveBeenCalledTimes(1);
    if (mode === "failure") render.destroy();
  },
);
