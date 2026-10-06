import { expect, it, vi } from "vitest";
import { Scene, Group, Raycaster, Vector3 } from "three";
import { createMapLighting } from "./mapLighting";
import { createLightMarkers } from "./lightMarkers";
vi.mock("./shadowProxies", () => ({
  createShadowProxies: () => ({
    root: new Group(),
    update: () => "geometry",
    advance: () => false,
    destroy() {},
  }),
}));
it("restores the previous fixed lighting, without point lights, shadows or flicker, and keeps the configured sources", () => {
  const scene = new Scene(),
    gpu = { shadowMap: {} },
    lighting = createMapLighting(scene, gpu, { catalogue: () => [] });
  const d = {
    width: 8,
    height: 8,
    sun: { enabled: false, angle: 90, elevation: 30 },
    lights: [
      {
        id: "lamp",
        enabled: true,
        showMarker: true,
        shadows: true,
        flicker: true,
        color: "#ffc36a",
        x: 2,
        y: 2,
        elevation: 0,
        height: 1,
        intensity: 8,
        radius: 4,
      },
    ],
    areas: [],
    tiles: [],
    objects: [],
    lightingEnabled: true,
  };
  const update = () =>
    lighting.update(d, { editLights: true }, {}, [], [], { x: 4, y: 4 });
  update();
  expect(scene.children.filter((n) => n.isPointLight)).toHaveLength(1);
  expect(gpu.shadowMap.enabled).toBe(true);
  expect(lighting.advance(100, () => {}, [])).toBe(true);
  d.lightingEnabled = false;
  update();
  expect(scene.children.filter((n) => n.isPointLight)).toHaveLength(0);
  const hemi = scene.children.find((n) => n.isHemisphereLight),
    [main, fill] = scene.children.filter((n) => n.isDirectionalLight);
  expect([
    hemi.color.getHex(),
    hemi.groundColor.getHex(),
    hemi.intensity,
  ]).toEqual([0xffffff, 0x625141, 2]);
  expect(main.position.toArray()).toEqual([-20, 40, -25]);
  expect([
    main.visible,
    main.intensity,
    main.castShadow,
    fill.color.getHex(),
    fill.intensity,
  ]).toEqual([true, 3, false, 0xe0e8ff, 0.6]);
  expect(gpu.shadowMap.enabled).toBe(false);
  expect(lighting.advance(100, () => {}, [])).toBe(false);
  expect(d.lights).toHaveLength(1);
  d.lightingEnabled = true;
  update();
  expect(scene.children.filter((n) => n.isPointLight)).toHaveLength(1);
  expect(main.visible).toBe(false);
  lighting.destroy();
});
it("hides an unchecked source sphere from picking while showing the placement preview", () => {
  const markers = createLightMarkers(),
    light = {
      id: "lamp",
      x: 2,
      y: 2,
      worldHeight: 1,
      color: "#ffaa44",
      enabled: true,
      showMarker: true,
    },
    ray = new Raycaster(new Vector3(2, 4, 2), new Vector3(0, -1, 0));
  markers.update([light], { editLights: true });
  expect(markers.hit(ray)?.lightId).toBe("lamp");
  markers.update([{ ...light, showMarker: false }], {
    editLights: true,
    selectedLight: "lamp",
  });
  expect(markers.hit(ray)).toBe(null);
  markers.update([{ ...light, showMarker: false }], {
    editLights: true,
    previewLight: light,
  });
  expect(markers.hit(ray)?.lightId).toBe("lamp");
  markers.destroy();
});
