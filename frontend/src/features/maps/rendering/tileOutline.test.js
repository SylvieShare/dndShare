import { expect, it, vi } from "vitest";
import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PointLight,
  Scene,
} from "three";
import { createTileOutline } from "./tileOutline";

function setup() {
  let target = null,
    ratio = 1.5,
    width = 800,
    height = 600,
    alpha = 1,
    colour = new Color("#123456");
  const element = new EventTarget(),
    gpu = {
      domElement: element,
      autoClear: true,
      shadowMap: { enabled: true },
      getDrawingBufferSize: (v) => v.set(width, height),
      getPixelRatio: () => ratio,
      getRenderTarget: () => target,
      setRenderTarget: vi.fn((t) => {
        target = t;
      }),
      getClearAlpha: () => alpha,
      getClearColor: (c) => c.copy(colour),
      setClearColor: (c, a) => {
        colour = new Color(c);
        alpha = a;
      },
      clear: vi.fn(),
      render: vi.fn((scene) => scene.updateMatrixWorld(true)),
    };
  const geometry = new BoxGeometry(1, 1, 1),
    material = new MeshBasicMaterial(),
    object = new Group(),
    occluder = new Mesh(geometry, material),
    helpers = new Group(),
    annotations = new Group(),
    scene = new Scene(),
    camera = new OrthographicCamera(-3, 3, 3, -3, 0.1, 50);
  object.add(new Mesh(geometry, material));
  object.userData.outlineType = "object";
  object.userData.outlineStyle = "selected";
  occluder.position.set(2, 0, 0);
  helpers.add(new Mesh(geometry, material));
  scene.background = new Color("#444444");
  scene.add(object, occluder, helpers, annotations, new PointLight());
  camera.position.set(0, 4, 5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const outline = createTileOutline(gpu, {});
  const draw = () => {
    scene.updateMatrixWorld(true);
    gpu.render.mockClear();
    outline.render(scene, camera, annotations, [object], null, [helpers]);
    return gpu.render.mock.calls.length;
  };
  return {
    gpu,
    object,
    occluder,
    helpers,
    scene,
    camera,
    outline,
    geometry,
    material,
    draw,
    resize() {
      width = 1000;
      height = 700;
    },
    pixelRatio() {
      ratio = 1;
    },
    element,
  };
}
it("reuses both depth/mask and the edge result when only lighting/material uniforms change", () => {
  const f = setup();
  expect(f.draw()).toBe(4);
  expect(f.draw()).toBe(1);
  f.scene.children.find((n) => n.isPointLight).position.x += 1;
  f.material.color.set("#ff0000");
  f.material.opacity = 0.5;
  f.material.needsUpdate = true;
  f.helpers.position.x = 3;
  f.helpers.visible = false;
  expect(f.draw()).toBe(1);
  expect(f.gpu.autoClear).toBe(true);
  expect(f.gpu.shadowMap.enabled).toBe(true);
  expect(f.scene.overrideMaterial).toBe(null);
  expect(f.object.visible).toBe(true);
  f.outline.destroy();
});
it("invalidates for camera, occluder movement/visibility, geometry, selection, size and context restoration", () => {
  const f = setup();
  expect(f.draw()).toBe(4);
  f.camera.position.x += 1;
  f.camera.updateMatrixWorld(true);
  expect(f.draw()).toBe(4);
  expect(f.draw()).toBe(1);
  f.occluder.position.x += 0.5;
  expect(f.draw()).toBe(4);
  f.occluder.visible = false;
  expect(f.draw()).toBe(4);
  f.object.position.x += 0.5;
  expect(f.draw()).toBe(4);
  f.object.userData.outlineStyle = "hover";
  expect(f.draw()).toBe(4);
  f.geometry.attributes.position.needsUpdate = true;
  expect(f.draw()).toBe(4);
  f.object.children[0].geometry = new BoxGeometry(0.5, 1, 0.5);
  expect(f.draw()).toBe(4);
  expect(f.draw()).toBe(1);
  f.resize();
  expect(f.draw()).toBe(4);
  f.pixelRatio();
  expect(f.draw()).toBe(4);
  f.element.dispatchEvent(new Event("webglcontextrestored"));
  expect(f.draw()).toBe(4);
  expect(f.draw()).toBe(1);
  f.outline.destroy();
});
it("ignores instance upload-version churn for an unchanged placement preview, but follows actual matrices", () => {
  const f = setup();
  f.object.clear();
  const instances = new InstancedMesh(f.geometry, f.material, 2);
  instances.setMatrixAt(0, new Matrix4());
  instances.setMatrixAt(1, new Matrix4().makeTranslation(1, 0, 0));
  f.object.add(instances);
  expect(f.draw()).toBe(4);
  instances.instanceMatrix.needsUpdate = true;
  expect(f.draw()).toBe(1);
  instances.setMatrixAt(1, new Matrix4().makeTranslation(1.5, 0, 0));
  instances.instanceMatrix.needsUpdate = true;
  expect(f.draw()).toBe(4);
  expect(f.draw()).toBe(1);
  f.outline.destroy();
});
it("does not composite a previous selection after clearing it and disposes both cached targets", () => {
  const f = setup();
  expect(f.draw()).toBe(4);
  const targets = [
    ...new Set(
      f.gpu.setRenderTarget.mock.calls
        .map(([target]) => target)
        .filter(Boolean),
    ),
  ];
  const disposed = targets.map((target) => {
    const listener = vi.fn();
    target.addEventListener("dispose", listener);
    return listener;
  });
  f.gpu.render.mockClear();
  f.outline.render(f.scene, f.camera, f.helpers, [], null, []);
  expect(f.gpu.render).not.toHaveBeenCalled();
  expect(f.draw()).toBe(4);
  f.outline.destroy();
  expect(targets).toHaveLength(2);
  expect(disposed.every((listener) => listener.mock.calls.length === 1)).toBe(
    true,
  );
});
