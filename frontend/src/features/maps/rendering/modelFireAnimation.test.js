import { afterEach, expect, it, vi } from "vitest";
import { BoxGeometry, Group, Matrix4, Mesh, MeshStandardMaterial, Scene, ShaderLib, Texture } from "three";
import { createModelFireAnimation } from "./modelFireAnimation";

afterEach(() => vi.unstubAllGlobals());

function fixture() {
  const model = { definitionId: "MT1-016", maxHeight: 2.427057, behaviour: { animationFps: 12 } },
    material = new MeshStandardMaterial({ emissiveMap: new Texture() }),
    mesh = new Mesh(new BoxGeometry(), material),
    scene = new Scene(),
    fire = createModelFireAnimation(() => model);
  scene.add(mesh);
  fire.prepare(mesh, "torch", new Matrix4());
  const shader = { ...ShaderLib.standard, uniforms: {} };
  material.onBeforeCompile(shader, {});
  return { model, mesh, material, scene, fire, uniforms: shader.uniforms };
}

it("steps only flame time, changes frequency live and freezes reduced motion", () => {
  const { fire, model, uniforms } = fixture();
  expect(fire.advance(110)).toBeCloseTo(40, 3);
  expect(uniforms.modelFireTime.value).toBe(1 / 12);
  fire.advance(140);
  expect(uniforms.modelFireTime.value).toBe(1 / 12);
  fire.advance(170);
  expect(uniforms.modelFireTime.value).toBe(2 / 12);
  model.behaviour.animationFps = 60;
  fire.advance(170);
  expect(uniforms.modelFireTime.value).toBe(10 / 60);
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  expect(fire.advance(500)).toBe(Infinity);
  expect(uniforms.modelFireTime.value).toBe(0);
  expect(uniforms.modelFireMotion.value).toBe(0);
  fire.destroy();
});

it("sleeps for hidden meshes, ignores isolated area previews and releases disposed materials", () => {
  const { fire, mesh, scene, material } = fixture();
  const group = new Group();
  scene.add(group);
  group.add(mesh);
  group.visible = false;
  expect(fire.advance(100)).toBe(Infinity);
  group.visible = true;
  expect(fire.advance(100, true, undefined, new Scene())).toBe(Infinity);
  expect(fire.advance(100, true, undefined, scene)).toBeLessThan(100);
  material.opacity = 0;
  expect(fire.advance(100)).toBe(Infinity);
  material.opacity = 1;
  material.dispose();
  expect(fire.advance(100)).toBe(Infinity);
});

it("keeps paused snapshots static and uses draft FPS without changing catalogue defaults", () => {
  const { fire, model, uniforms } = fixture();
  expect(fire.advance(500, false)).toBe(Infinity);
  expect(uniforms.modelFireMotion.value).toBe(0);
  fire.advance(500, true, { behaviour: { animationFps: 1 } });
  expect(uniforms.modelFireTime.value).toBe(0);
  expect(model.behaviour.animationFps).toBe(12);
  fire.destroy();
});
