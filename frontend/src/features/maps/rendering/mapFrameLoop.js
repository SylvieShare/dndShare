import { applySceneAreaAppearance } from "./areaOpacity";

export function createMapFrameLoop({
  transitions,
  modelTransitions,
  preview,
  objectPreview,
  tiles,
  objectMotion,
  loadingPreview,
  volumeFog,
  lighting,
  effects,
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
    dead = false;
  function request() {
    if (frame || dead) return;
    clearTimeout(timer);
    timer = 0;
    frame = requestAnimationFrame((time) => {
      frame = 0;
      if (dead) return;
      const { objects, options, appearance } = getCurrent(),
        elapsed = time - lastFrame || 16,
        delta = Math.min(32, elapsed);
      profiler.begin();
      try {
        profiler.mark("areas");
        let moving =
          transitions.advance(delta) | modelTransitions.advance(delta);
        profiler.mark("tiles");
        moving |=
          preview.advance(delta) |
          tiles.advance(delta) |
          loadingPreview.advance(delta);
        profiler.mark("objects");
        moving |=
          objectPreview.advance(delta) | objectMotion.advance(delta, objects);
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
        );
        lastFrame = time;
        profiler.mark("areas");
        tiles.applyAppearance(appearance);
        applySceneAreaAppearance(objects, appearance);
        loadingPreview.applyAppearance(appearance);
        profiler.mark("effects");
        const effectFrame = effects.advance(
            time,
            delta,
            (id) => preview.transform(id) || tiles.transform(id),
            objects,
            objectPreview.root,
          ),
          fireDelay = Math.min(
            effectFrame.delay,
            water.advance(time, options.animate !== false),
          );
        profiler.mark("draw");
        volumeFog.render(scene, camera);
        profiler.mark("overlays");
        presentFrame(objects, options, appearance);
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
    destroy() {
      dead = true;
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    },
  };
}
