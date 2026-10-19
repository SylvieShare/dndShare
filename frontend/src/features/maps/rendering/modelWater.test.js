import { afterEach, expect, it, vi } from "vitest";
import {
  BufferAttribute,
  BoxGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  ShaderLib,
  OrthographicCamera,
} from "three";
import { createModelWaterAnimation, modelWaterMaterial } from "./modelWater";
import { applyAreaOpacity } from "./areaOpacity";

afterEach(() => vi.unstubAllGlobals());
function fountain(settings = { enabled: true, speed: 1, strength: 0.7 }) {
  const geometry = new BoxGeometry();
  geometry.setAttribute(
    "_water",
    new BufferAttribute(
      new Uint8Array(geometry.attributes.position.count * 2).fill(255),
      2,
      true,
    ),
  );
  const material = modelWaterMaterial(
      new MeshStandardMaterial({ roughness: 0.25 }),
      { geometry, matrix: new Matrix4() },
      settings,
    ),
    node = new Mesh(geometry, material),
    root = new Group(),
    animation = createModelWaterAnimation();
  root.add(node);
  animation.update([root]);
  const shader = {
    uniforms: {},
    vertexShader: ShaderLib.standard.vertexShader,
    fragmentShader: ShaderLib.standard.fragmentShader,
  };
  material.onBeforeCompile(shader, {});
  return { animation, shader, root, node, settings };
}
it("quantizes model water at 12 FPS and stops scheduling static or invisible surfaces", () => {
  const { animation, shader, root, settings } = fountain();
  expect(animation.advance(100)).toBeLessThan(84);
  expect(shader.uniforms.waterClock.value).toBe(1 / 12);
  animation.advance(150);
  expect(shader.uniforms.waterClock.value).toBe(1 / 12);
  animation.advance(167);
  expect(shader.uniforms.waterClock.value).toBe(2 / 12);
  settings.speed = 2;
  animation.advance(167);
  expect(shader.uniforms.waterClock.value).toBe(4 / 12);
  root.visible = false;
  expect(animation.advance(200)).toBe(Infinity);
  root.visible = true;
  settings.strength = 0;
  expect(animation.advance(200)).toBe(Infinity);
  expect(shader.uniforms.waterStrength.value).toBe(0);
  settings.strength = 0.7;
  settings.enabled = false;
  expect(animation.advance(200)).toBe(Infinity);
  expect(shader.uniforms.waterStrength.value).toBe(0);
});
it("freezes snapshots and reduced motion without sharing clocks across scenes", () => {
  const a = fountain(),
    b = fountain();
  a.animation.advance(500);
  b.animation.advance(2000);
  expect(a.shader.uniforms.waterClock.value).toBe(0.5);
  expect(b.shader.uniforms.waterClock.value).toBe(2);
  expect(a.animation.advance(4000, false)).toBe(Infinity);
  expect(a.shader.uniforms.waterClock.value).toBe(0);
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  expect(b.animation.advance(4000)).toBe(Infinity);
  expect(b.shader.uniforms.waterClock.value).toBe(0);
});
it("preserves area fading hooks and leaves unmarked models alone", () => {
  const { node } = fountain();
  applyAreaOpacity(node, 0.5);
  const shader = {
    uniforms: {},
    vertexShader: ShaderLib.standard.vertexShader,
    fragmentShader: ShaderLib.standard.fragmentShader,
  };
  node.material.onBeforeCompile(shader, {});
  expect(shader.uniforms.mapAreaFlash).toBeDefined();
  expect(shader.uniforms.waterClock).toBeDefined();
  expect(node.material.opacity).toBe(0.5);
  const plain = new MeshStandardMaterial(),
    hook = plain.onBeforeCompile;
  modelWaterMaterial(
    plain,
    { geometry: new BoxGeometry() },
    { enabled: true, speed: 1, strength: 1 },
  );
  expect(plain.onBeforeCompile).toBe(hook);
});

it("uses the painted PBR mask without new geometry and updates movement settings live", () => {
  const geometry = new BoxGeometry(),
    settings = {
      enabled: true,
      speed: 1,
      strength: 0.7,
      pattern: "surface",
      roughnessMax: 0.4,
      center: [0.2, -0.1],
    };
  const material = modelWaterMaterial(
    new MeshStandardMaterial({ roughness: 0.3 }),
    { geometry, matrix: new Matrix4() },
    settings,
  );
  const root = new Mesh(geometry, material),
    animation = createModelWaterAnimation();
  animation.update([root]);
  const shader = {
    uniforms: {},
    vertexShader: ShaderLib.standard.vertexShader,
    fragmentShader: ShaderLib.standard.fragmentShader,
  };
  material.onBeforeCompile(shader, {});
  expect(shader.vertexShader).not.toContain("attribute vec2 _water");
  expect(shader.uniforms.waterWorldSpace.value).toBe(1);
  expect(shader.uniforms.waterRoughnessMax.value).toBe(0.4);
  settings.pattern = "vortex";
  animation.advance(100);
  expect(shader.uniforms.waterWorldSpace.value).toBe(0);
  expect(shader.uniforms.waterPattern.value).toBe(2);
  expect(shader.uniforms.waterCenter.value.toArray()).toEqual([0.2, -0.1]);
});

it("stops requesting water frames outside the camera and resumes when it returns", () => {
  const { root, animation } = fountain(),
    camera = new OrthographicCamera(-2, 2, 2, -2, 0.01, 100);
  camera.position.set(0, 5, 5);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  root.position.x = 100;
  expect(animation.advance(100, true, camera)).toBe(Infinity);
  root.position.x = 0;
  expect(animation.advance(100, true, camera)).toBeLessThan(84);
});
