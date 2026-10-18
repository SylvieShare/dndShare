import { createScalarMotion, reducedMapMotion } from "./scalarMotion";
import { fogAreaMembers } from "../lib/mapAreas";
import {
  DirectionalLight,
  HemisphereLight,
  PointLight,
  PCFShadowMap,
  Vector3,
} from "three";
import { DEFAULT_SUN, lightOpacity, lightPose } from "../lib/mapLighting";
import { createAttachedLights } from "./attachedLights";
import { createLightMarkers } from "./lightMarkers";
import { createShadowProxies } from "./shadowProxies";
import { fireMotion } from "./fireMotion";
export function createMapLighting(scene, gpu, assets, onSettled) {
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
    markers = createLightMarkers(),
    attachments = createAttachedLights();
  scene.add(proxies.root, markers.root);
  gpu.shadowMap.enabled = true;
  gpu.shadowMap.type = PCFShadowMap;
  gpu.shadowMap.autoUpdate = false;
  const motion = createScalarMotion(() => {
    if (lastUpdate) update(...lastUpdate);
    onSettled?.();
  });
  let initialized = false,
    visualAppearance,
    lastUpdate,
    animate = true;
  const opacity = (source) =>
    visualAppearance?.lightOpacity(source) ?? source.opacity;
  function environment() {
    ambient.intensity = motion.value("ambient");
    sun.intensity = motion.value("sun");
    fill.intensity = motion.value("fill");
    sun.visible = sun.intensity > 0.001 || motion.target("sun") > 0;
    fill.visible = fill.intensity > 0.001 || motion.target("fill") > 0;
    sun.castShadow = enabled && sun.visible;
    gpu.shadowMap.enabled =
      enabled ||
      active.some((l) => l.shadows && motion.value(`source:${l.id}`) > 0.001);
    proxies.root.visible = gpu.shadowMap.enabled;
  }
  let slots = [],
    key = "",
    proxyKey = "",
    active = [],
    clock = 0,
    sunKey = "",
    enabled = false,
    sources = [];
  function update(
    d,
    options,
    context,
    placed,
    objects,
    view,
    objectRoot,
    objectPreview,
    appearance,
  ) {
    lastUpdate = [
      d,
      options,
      context,
      placed,
      objects,
      view,
      objectRoot,
      objectPreview,
      appearance,
    ];
    enabled = !!d.lightingEnabled;
    animate = options.animate !== false;
    visualAppearance = appearance;
    const immediate =
      !initialized || options.animate === false || reducedMapMotion();
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
    motion.set("sun", !enabled ? 3 : settings.enabled ? 2.8 : 0, {
      immediate,
      duration: 380,
    });
    motion.set("fill", !enabled ? 0.6 : settings.enabled ? 0.18 : 0, {
      immediate,
      duration: 380,
    });
    motion.set("ambient", enabled ? (settings.enabled ? 0.6 : 0.28) : 2, {
      immediate,
      duration: 380,
    });
    fill.color.set(enabled ? 0xbdcfff : 0xe0e8ff);
    ambient.color.set(enabled ? 0xcbd5ee : 0xffffff);
    ambient.groundColor.set(enabled ? 0x695641 : 0x625141);
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
    const mist = fogAreaMembers(d);
    const all = [
      ...(d.lights || []).filter((l) => l.id !== options.previewLight?.id),
      ...(options.previewLight ? [options.previewLight] : []),
    ].map((l) => ({
      ...lightPose(l, d, assets.catalogue(), context),
      opacity: lightOpacity(l, d, options.areaMode, mist),
    }));
    for (const light of all) if (light.moving) light.worldHeight += 0.22;
    sources = all;
    const keys = new Set(["sun", "ambient", "fill"]);
    for (const source of all) {
      const id = `source:${source.id}`,
        target = enabled && source.enabled ? 1 : 0;
      keys.add(id);
      motion.set(id, target, {
        immediate,
        duration: 360,
        initial: initialized ? 0 : target,
      });
    }
    motion.retain(keys);
    initialized = true;
    environment();
    attachments.update(all, placed, objects, assets.catalogue());
    markers.update(
      all.filter((l) => l.opacity > 0 || opacity(l) > 0.001),
      options,
    );
    const next = all
      .filter(
        (l) =>
          (motion.target(`source:${l.id}`) > 0 ||
            motion.value(`source:${l.id}`) > 0.001) &&
          (l.opacity > 0 || opacity(l) > 0.001),
      )
      .sort(
        (a, b) =>
          Number(motion.target(`source:${b.id}`) > 0 && b.opacity > 0) -
            Number(motion.target(`source:${a.id}`) > 0 && a.opacity > 0) ||
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
    next.forEach((source, i) => {
      const light = slots[i];
      light.color.set(source.color);
      light.position.set(source.x, source.worldHeight, source.y);
      light.distance = source.radius;
      light.decay = 2;
      light.castShadow = !!source.shadows;
      light.shadow.camera.far = source.radius;
      light.shadow.camera.updateProjectionMatrix();
      light.intensity =
        source.intensity *
        opacity(source) *
        motion.value(`source:${source.id}`);
    });
    active = next;
    markers.applyAppearance(all, opacity, (id) => motion.value(`source:${id}`));
    const nextProxy = gpu.shadowMap.enabled
      ? proxies.update(d, placed, objects, options, objectRoot, objectPreview)
      : "";
    if (proxyKey !== nextProxy) {
      proxyKey = nextProxy;
      gpu.shadowMap.needsUpdate = true;
    }
  }
  function advance(
    delta,
    tileMatrix,
    objects,
    objectPreview,
    elapsed = delta,
    time,
  ) {
    const fading = motion.advance(delta, reducedMapMotion());
    environment();
    markers.applyAppearance(sources, opacity, (id) =>
      motion.value(`source:${id}`),
    );
    const slotsById = new Map(active.map((l, i) => [l.id, slots[i]]));
    clock += elapsed / 1000;
    const stationary = !animate || reducedMapMotion(),
      now = time ?? clock * 1000,
      position = new Vector3();
    for (const source of sources) {
      const attached = attachments.position(
        source,
        tileMatrix,
        objects,
        objectPreview,
      );
      if (attached) position.copy(attached);
      else position.set(source.x, source.worldHeight, source.y);
      const motion = fireMotion(source, now, stationary || !source.enabled);
      position.x += motion.offset[0];
      position.y += motion.offset[1];
      position.z += motion.offset[2];
      markers.move(source.id, position);
      const light = slotsById.get(source.id);
      if (light && !light.position.equals(position)) {
        light.position.copy(position);
        gpu.shadowMap.needsUpdate = true;
      }
    }
    if (proxies.advance(tileMatrix, objects, objectPreview))
      gpu.shadowMap.needsUpdate = true;
    let moving = fading;
    active.forEach((source, i) => {
      const fire = fireMotion(source, now, stationary),
        flicker = source.effect
          ? fire.gain
          : source.flicker && !stationary
            ? 1 +
              0.035 * Math.sin(clock * 8.2 + i * 2) +
              0.025 * Math.sin(clock * 13.7 + i)
            : 1;
      slots[i].intensity =
        source.intensity *
        opacity(source) *
        motion.value(`source:${source.id}`) *
        flicker;
      moving ||=
        (fire.moving || (source.flicker && !stationary && !source.effect)) &&
        motion.value(`source:${source.id}`) > 0.001 &&
        opacity(source) > 0.001;
    });
    return moving;
  }
  return {
    update,
    advance,
    isFading: motion.isMoving,
    pick: markers.hit,
    position(id) {
      const index = active.findIndex((light) => light.id === id);
      if (index >= 0) return slots[index].position;
      const source = sources.find((light) => light.id === id);
      return source && new Vector3(source.x, source.worldHeight, source.y);
    },
    excluded: [proxies.root, markers.root],
    invalidateShadows() {
      gpu.shadowMap.needsUpdate = true;
    },
    destroy() {
      motion.clear();
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
