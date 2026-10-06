import {
  DirectionalLight,
  HemisphereLight,
  PointLight,
  PCFShadowMap,
  Vector3,
} from "three";
import { DEFAULT_SUN, lightOpacity, lightPose } from "../lib/mapLighting";
import { createLightMarkers } from "./lightMarkers";
import { createShadowProxies } from "./shadowProxies";
export function createMapLighting(scene, gpu, assets) {
  const ambient = new HemisphereLight(0xcbd5ee, 0x695641, 0.6),
    sun = new DirectionalLight(0xfff2df, 2.8),
    fill = new DirectionalLight(0xbdcfff, 0.18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.normalBias = 0.025;
  sun.shadow.bias = -0.0002;
  fill.position.set(20, 12, 25);
  scene.add(ambient, sun, sun.target, fill);
  const proxies = createShadowProxies(assets),
    markers = createLightMarkers();
  scene.add(proxies.root, markers.root);
  gpu.shadowMap.enabled = true;
  gpu.shadowMap.type = PCFShadowMap;
  gpu.shadowMap.autoUpdate = false;
  let slots = [],
    key = "",
    proxyKey = "",
    active = [],
    clock = 0,
    sunKey = "",
    enabled = false;
  function update(
    d,
    options,
    context,
    placed,
    objects,
    view,
    objectRoot,
    objectPreview,
  ) {
    enabled = !!d.lightingEnabled;
    gpu.shadowMap.enabled = enabled;
    proxies.root.visible = enabled;
    const settings = d.sun || DEFAULT_SUN,
      sky = JSON.stringify([
        enabled,
        settings,
        d.width,
        d.height,
        options.sceneHeight,
      ]);
    sun.visible = !enabled || settings.enabled;
    sun.castShadow = enabled && settings.enabled;
    sun.intensity = enabled ? 2.8 : 3;
    fill.visible = !enabled || settings.enabled;
    fill.color.set(enabled ? 0xbdcfff : 0xe0e8ff);
    fill.intensity = enabled ? 0.18 : 0.6;
    ambient.color.set(enabled ? 0xcbd5ee : 0xffffff);
    ambient.groundColor.set(enabled ? 0x695641 : 0x625141);
    ambient.intensity = enabled ? (settings.enabled ? 0.6 : 0.28) : 2;
    if (sky !== sunKey) {
      sunKey = sky;
      if (!enabled) {
        sun.target.position.set(0, 0, 0);
        sun.position.set(-20, 40, -25);
      } else {
        const angle = (settings.angle * Math.PI) / 180,
          e = (settings.elevation * Math.PI) / 180,
          distance = Math.max(d.width, d.height) * 2 + 30;
        const center = new Vector3(d.width / 2, 0, d.height / 2);
        sun.target.position.copy(center);
        sun.position
          .copy(center)
          .add(
            new Vector3(
              Math.sin(angle) * Math.cos(e) * distance,
              Math.sin(e) * distance,
              Math.cos(angle) * Math.cos(e) * distance,
            ),
          );
        const radius = Math.hypot(d.width, d.height) / 2 + 10,
          c = sun.shadow.camera;
        c.left = c.bottom = -radius;
        c.right = c.top = radius;
        c.near = 0.1;
        c.far = distance * 3;
        c.updateProjectionMatrix();
        gpu.shadowMap.needsUpdate = true;
      }
    }
    const all = [
      ...(d.lights || []).filter((l) => l.id !== options.previewLight?.id),
      ...(options.previewLight ? [options.previewLight] : []),
    ].map((l) => ({
      ...lightPose(l, d, assets.catalogue(), context),
      opacity: lightOpacity(l, d, options.areaMode),
    }));
    markers.update(
      all.filter((l) => l.opacity > 0),
      options,
    );
    const next = all
      .filter((l) => enabled && l.enabled && l.opacity > 0)
      .sort(
        (a, b) =>
          Number(b.id === options.selectedLight) -
            Number(a.id === options.selectedLight) ||
          Number(b.shadows) - Number(a.shadows) ||
          Math.hypot(a.x - view.x, a.y - view.y) -
            Math.hypot(b.x - view.x, b.y - view.y),
      )
      .slice(0, 8);
    if (next.length !== slots.length) {
      slots.forEach((light) => {
        scene.remove(light);
        light.shadow.map?.dispose();
        light.dispose();
      });
      slots = [];
      for (let i = 0; i < next.length; i++) {
        const light = new PointLight();
        light.shadow.mapSize.set(512, 512);
        light.shadow.bias = -0.0002;
        light.shadow.normalBias = 0.025;
        light.shadow.camera.near = 0.05;
        scene.add(light);
        slots.push(light);
      }
    }
    const nextKey = JSON.stringify(next);
    if (nextKey !== key) {
      key = nextKey;
      gpu.shadowMap.needsUpdate = true;
    }
    let shadows = 0;
    next.forEach((source, i) => {
      const light = slots[i];
      light.color.set(source.color);
      light.position.set(source.x, source.worldHeight, source.y);
      light.distance = source.radius;
      light.decay = 2;
      light.castShadow = !!source.shadows && shadows++ < 2;
      light.shadow.camera.far = source.radius;
      light.shadow.camera.updateProjectionMatrix();
      light.intensity = source.intensity * source.opacity;
    });
    active = next;
    const nextProxy = enabled
      ? proxies.update(d, placed, objects, options, objectRoot, objectPreview)
      : "";
    if (proxyKey !== nextProxy) {
      proxyKey = nextProxy;
      gpu.shadowMap.needsUpdate = true;
    }
  }
  function advance(delta, tileMatrix, objects, objectPreview) {
    if (!enabled) return false;
    clock += delta / 1000;
    if (proxies.advance(tileMatrix, objects, objectPreview))
      gpu.shadowMap.needsUpdate = true;
    let moving = false;
    active.forEach((source, i) => {
      const flicker = source.flicker
        ? 1 +
          0.035 * Math.sin(clock * 8.2 + i * 2) +
          0.025 * Math.sin(clock * 13.7 + i)
        : 1;
      slots[i].intensity = source.intensity * source.opacity * flicker;
      moving ||= source.flicker;
    });
    return moving;
  }
  return {
    update,
    advance,
    pick: markers.hit,
    excluded: [proxies.root, markers.root],
    invalidateShadows() {
      gpu.shadowMap.needsUpdate = true;
    },
    destroy() {
      proxies.destroy();
      markers.destroy();
      slots.forEach((l) => {
        scene.remove(l);
        l.shadow.map?.dispose();
        l.dispose();
      });
      sun.shadow.map?.dispose();
      sun.dispose();
      scene.remove(sun, sun.target, fill, ambient);
    },
  };
}
