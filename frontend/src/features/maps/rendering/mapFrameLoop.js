import { applySceneAreaAppearance } from "./areaOpacity";

export function createMapFrameLoop({
  transitions,
  modelTransitions,
  preview,
  objectPreview,
  tiles,
  objectMotion,
  objectLayer,
  loadingPreview,
  volumeFog,
  lighting,
  effects,
  decals,
  water,
  scene,
  camera,
  presentFrame,
  profiler,
  getCurrent,
}) {
  let frame = 0,
    timer = 0,
    lastFrame = 0,
    dead = false,
    active = true,
    geometryWasMoving = false;
  function request() {
    if (frame || dead || !active) return;
    clearTimeout(timer);
    timer = 0;
    frame = requestAnimationFrame((time) => {
      frame = 0;
      if (dead || !active) return;
      const { objects, options, appearance } = getCurrent(),
        elapsed = time - lastFrame || 16,
        delta = Math.min(32, elapsed);
      profiler.begin();
      try {
        profiler.mark("areas");
        let moving =
          transitions.advance(delta) | modelTransitions.advance(delta);
        profiler.mark("tiles");
        moving |= preview.advance(delta) | tiles.advance(delta);
        const loading = loadingPreview.advance(delta);
        profiler.mark("objects");
        const parentMoving = !!moving || geometryWasMoving;
        const objectDirty = objectMotion.needsUpdate || parentMoving;
        moving |=
          objectPreview.advance(delta) |
          objectMotion.advance(delta, objects, parentMoving);
        if (objectDirty || geometryWasMoving)
          objectLayer.advance(objectMotion.changed);
        profiler.mark("fog");
        const mistMoving =
          options.animate !== false && volumeFog.advance(delta, elapsed);
        profiler.mark("lighting");
        const flickering = lighting.advance(
          delta,
          (id) => preview.transform(id) || tiles.transform(id),
          objects,
          objectPreview.root,
          Math.min(250, elapsed),
          time,
          !!moving || geometryWasMoving || !!objectDirty,
        );
        lastFrame = time;
        profiler.mark("areas");
        tiles.applyAppearance(appearance);
        applySceneAreaAppearance(objects, appearance);
        objectLayer.applyAppearance();
        loadingPreview.applyAppearance(appearance);
        profiler.mark("decals");
        decals?.advance();
        profiler.mark("effects");
        const effectFrame = effects.advance(
            time,
            delta,
            (id) => preview.transform(id) || tiles.transform(id),
            objects,
            objectPreview.root,
            camera,
          ),
          fireDelay = Math.min(
            effectFrame.delay,
            water.advance(time, options.animate !== false, camera),
          );
        if (
          (moving || effectFrame.moving || geometryWasMoving) &&
          scene.userData.outlineRevision !== undefined
        )
          scene.userData.outlineRevision++;
        geometryWasMoving = !!(moving || effectFrame.moving);
        moving |= loading;
        profiler.mark("draw");
        const frameDepth = volumeFog.render(scene, camera);
        profiler.mark("overlays");
        presentFrame(objects, options, appearance, frameDepth);
        if (moving || lighting.isFading() || effectFrame.moving) request();
        else if (
          (flickering || mistMoving || Number.isFinite(fireDelay)) &&
          !timer
        )
          timer = setTimeout(
            () => {
              timer = 0;
              request();
            },
            Math.max(
              1,
              Math.min(flickering || mistMoving ? 100 : Infinity, fireDelay),
            ),
          );
      } finally {
        profiler.end();
      }
    });
  }
  return {
    request,
    setActive(value) {
      if (active === value) return;
      active = value;
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      frame = timer = lastFrame = 0;
      if (active) request();
    },
    destroy() {
      dead = true;
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    },
  };
}
