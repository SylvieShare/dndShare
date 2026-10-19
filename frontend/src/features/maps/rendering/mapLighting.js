import { createScalarMotion, reducedMapMotion } from "./scalarMotion";
import {
  DirectionalLight,
  HemisphereLight,
  PCFShadowMap,
  Vector3,
  Frustum,
  Matrix4,
  Sphere,
} from "three";
import { DEFAULT_SUN } from "../lib/mapLighting";
import { createLightSourceState } from "./lightSourceState";
import { createLightMarkers } from "./lightMarkers";
import { createShadowProxies } from "./shadowProxies";
import { createLightPool } from "./lightPool";
export function createMapLighting(
  scene,
  gpu,
  assets,
  onSettled,
  sharedSources,
  camera,
) {
  const ambient = new HemisphereLight(0xcbd5ee, 0x695641, 0.6),
    sun = new DirectionalLight(0xfff2df, 2.8),
    fill = new DirectionalLight(0xbdcfff, 0.18);
  sun.castShadow = true;
  sun.shadow.autoUpdate = false;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.normalBias = 0.025;
  sun.shadow.bias = -0.0002;
  fill.position.set(20, 12, 25);
  scene.add(ambient, sun, sun.target, fill);
  const proxies = createShadowProxies(assets),
    markers = createLightMarkers(),
    sourceState = sharedSources || createLightSourceState(assets);
  scene.add(proxies.root, markers.root);
  gpu.shadowMap.enabled = true;
  gpu.shadowMap.type = PCFShadowMap;
  gpu.shadowMap.autoUpdate = false;
  const motion = createScalarMotion(() => {
    if (lastUpdate) update(...lastUpdate);
    onSettled?.();
  });
  const pool = createLightPool(scene, gpu);
  const frustum = new Frustum(),
    projection = new Matrix4(),
    influence = new Sphere();
  function visible(source) {
    if (!camera) return true;
    influence.center.set(source.x, source.worldHeight, source.y);
    influence.radius = source.radius;
    return frustum.intersectsSphere(influence);
  }
  const invalidateAll = () => {
    if (sun.castShadow) pool.invalidate(sun);
    for (const light of slots) if (light.castShadow) pool.invalidate(light);
  };
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
    proxyKey = "",
    active = [],
    clock = 0,
    sunKey = "",
    enabled = false,
    sources = [],
    proxyDirty = true;
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
        pool.invalidate(sun);
      }
    }
    if (!sharedSources)
      sourceState.update(d, options, context, placed, objects);
    const all = sourceState.lights;
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
    select(options, view);
    const nextProxy = gpu.shadowMap.enabled
      ? proxies.update(d, placed, objects, options, objectRoot, objectPreview)
      : "";
    proxyDirty = true;
    if (proxyKey !== nextProxy) {
      proxyKey = nextProxy;
      invalidateAll();
    }
  }
  function select(options, view) {
    if (camera)
      frustum.setFromProjectionMatrix(
        projection.multiplyMatrices(
          camera.projectionMatrix,
          camera.matrixWorldInverse,
        ),
      );
    markers.update(
      sources.filter((l) => l.opacity > 0 || opacity(l) > 0.001),
      options,
    );
    const next = sources
      .filter(
        (l) =>
          (motion.target(`source:${l.id}`) > 0 ||
            motion.value(`source:${l.id}`) > 0.001) &&
          (l.opacity > 0 || opacity(l) > 0.001) &&
          visible(l),
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
    slots = pool.sync(next);
    next.forEach((source, i) => {
      const light = slots[i];
      light.color.set(source.color);
      const pose = `${source.x}:${source.worldHeight}:${source.y}:${source.radius}:${!!source.shadows}`;
      if (pose !== light.userData.pose) {
        light.userData.pose = pose;
        light.position.set(source.x, source.worldHeight, source.y);
        if (source.shadows) pool.invalidate(light);
      }
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
    markers.applyAppearance(sources, opacity, (id) =>
      motion.value(`source:${id}`),
    );
    environment();
  }
  function advance(
    delta,
    tileMatrix,
    objects,
    objectPreview,
    elapsed = delta,
    time,
    geometryMoving = true,
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
      const attached = sourceState.position(
        source,
        false,
        now,
        tileMatrix,
        objects,
        objectPreview,
      );
      if (attached) position.copy(attached);
      else position.set(source.x, source.worldHeight, source.y);
      const motion = sourceState.fire(
        source,
        now,
        stationary || !source.enabled,
      );
      position.x += motion.offset[0];
      position.y += motion.offset[1];
      position.z += motion.offset[2];
      markers.move(source.id, position);
      const light = slotsById.get(source.id);
      if (light && !light.position.equals(position)) {
        light.position.copy(position);
        if (light.castShadow) pool.invalidate(light);
      }
    }
    if (
      (proxyDirty || geometryMoving) &&
      proxies.advance(tileMatrix, objects, objectPreview)
    )
      invalidateAll();
    proxyDirty = false;
    let moving = fading;
    active.forEach((source, i) => {
      const fire = sourceState.fire(source, now, stationary || !source.enabled),
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
    selection(options, view) {
      if (!lastUpdate) return;
      lastUpdate[1] = { ...lastUpdate[1], ...options };
      if (view) lastUpdate[5] = view;
      select(lastUpdate[1], lastUpdate[5]);
    },
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
      invalidateAll();
    },
    destroy() {
      motion.clear();
      proxies.destroy();
      markers.destroy();
      pool.destroy();
      sun.shadow.map?.dispose();
      sun.dispose();
      scene.remove(sun, sun.target, fill, ambient);
    },
  };
}
