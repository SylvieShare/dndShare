import { expect, it, vi, afterEach } from "vitest";
import { Group, Matrix4, Scene, ShaderLib } from "three";
import { createMapEffects } from "./mapEffects";

afterEach(() => vi.unstubAllGlobals());
function fixture() {
  const scene = new Scene(),
    objects = new Group(),
    effects = createMapEffects(
      scene,
      { material: (m) => m },
      { catalogue: () => [] },
    ),
    d = {
      width: 10,
      height: 10,
      tiles: [],
      objects: [],
      areas: [],
      lightingEnabled: false,
      flags: [{ id: "burning", name: "Горит", enabled: true }],
      effects: [
        {
          id: "fire",
          kind: "fire",
          color: "#ffb04a",
          size: [0.2, 0.35],
          strength: 0.7,
          x: 1,
          y: 2,
          height: 0.5,
          elevation: 0,
          offset: [0, 0],
          enabled: true,
          flagId: "burning",
        },
      ],
    };
  scene.add(objects);
  effects.update(d, {}, null, [], []);
  const mesh = effects.root.children[0],
    shader = { ...ShaderLib.basic, uniforms: {} };
  mesh.material.onBeforeCompile(shader, {});
  return {
    effects,
    d,
    mesh,
    uniforms: shader.uniforms,
    advance: (time, delta = 16) =>
      effects.advance(time, delta, () => null, objects),
  };
}

it("renders independently of map lighting, stays at 12 FPS and never casts an opaque shadow", () => {
  const { effects, mesh, uniforms, advance } = fixture();
  expect(mesh.castShadow).toBe(false);
  expect(advance(110).delay).toBeCloseTo(40, 3);
  expect(uniforms.effectClock.value).toBe(1 / 12);
  advance(140);
  expect(uniforms.effectClock.value).toBe(1 / 12);
  advance(170);
  expect(uniforms.effectClock.value).toBe(2 / 12);
  expect(mesh.visible).toBe(true);
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  expect(advance(500).delay).toBe(Infinity);
  expect(uniforms.effectClock.value).toBe(0);
  effects.destroy();
  expect(effects.root.children).toHaveLength(0);
});

it("fades off with a flag and keeps an individually disabled effect off after the flag returns", () => {
  const { effects, d, mesh, advance } = fixture();
  advance(0);
  d.flags[0].enabled = false;
  effects.update(d, {}, null, [], []);
  advance(100, 80);
  expect(mesh.material.opacity).toBeGreaterThan(0);
  expect(mesh.material.opacity).toBeLessThan(1);
  expect(advance(500, 1000).delay).toBe(Infinity);
  expect(mesh.visible).toBe(false);
  expect(d.effects[0].enabled).toBe(true);
  d.effects[0].enabled = false;
  d.flags[0].enabled = true;
  effects.update(d, {}, null, [], []);
  advance(600, 1000);
  expect(mesh.visible).toBe(false);
  effects.destroy();
});
