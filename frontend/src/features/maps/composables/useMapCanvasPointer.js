import { onBeforeUnmount } from "vue";

export function useMapCanvasPointer(host, props, getRenderer, emit, setView) {
  let drag = null;
  function pointAt(event) {
    const r = host.value?.getBoundingClientRect();
    if (
      !r ||
      !getRenderer() ||
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      return null;
    return (
      getRenderer().placementPoint?.(
        event,
        props.placementModel,
        props.previewTile || { rotation: props.placementRotation || 0 },
      ) || getRenderer().world(event)
    );
  }
  function down(event) {
    if (props.readonly || !getRenderer() || drag) return;
    host.value.focus({ preventScroll: true });
    host.value.setPointerCapture(event.pointerId);
    const hit = getRenderer().pick(event);
    const additive = event.metaKey || event.ctrlKey;
    drag = {
      id: event.pointerId,
      orbit: event.button === 2 || event.shiftKey,
      pan:
        event.button === 1 ||
        event.altKey ||
        props.tool === "pan" ||
        (props.tool === "select" && event.button === 0 && !additive && !hit),
      emptyPan:
        props.tool === "select" && event.button === 0 && !additive && !hit,
      screen: { x: event.clientX, y: event.clientY },
      point: hit?.point || pointAt(event),
      view: getRenderer().getView(),
      region: !!props.selectedTiles && props.tool === "select" && additive,
    };
    if ((!drag.pan || drag.emptyPan) && !drag.orbit)
      emit("gesture", {
        phase: "start",
        point: drag.point,
        hit,
        event,
      });
  }
  function move(event) {
    if (!getRenderer() || props.readonly) return;
    const point =
      drag?.point?.elevation !== undefined &&
      (!props.placementModel || drag.pan || drag.orbit || drag.region)
        ? {
            ...getRenderer().world(event, drag.point.elevation),
            elevation: drag.point.elevation,
          }
        : pointAt(event);
    if (!drag) {
      emit("gesture", {
        phase: "hover",
        point,
        hit: getRenderer().pick(event),
        event,
      });
      return;
    }
    if (event.pointerId !== drag.id) return;
    if (drag.orbit) {
      setView({
        ...drag.view,
        fit: false,
        azimuth:
          (drag.view.azimuth + (event.clientX - drag.screen.x) * 0.4) % 360,
        tilt: Math.max(
          20,
          Math.min(90, drag.view.tilt + (event.clientY - drag.screen.y) * 0.25),
        ),
      });
    } else if (drag.pan) {
      const v = getRenderer().getView();
      setView({
        ...v,
        fit: false,
        x: v.x + drag.point.x - point.x,
        y: v.y + drag.point.y - point.y,
      });
    } else {
      const r = host.value.getBoundingClientRect();
      const screenRect = drag.region
        ? {
            left: Math.min(drag.screen.x, event.clientX) - r.left,
            top: Math.min(drag.screen.y, event.clientY) - r.top,
            width: Math.abs(drag.screen.x - event.clientX),
            height: Math.abs(drag.screen.y - event.clientY),
          }
        : null;
      emit("gesture", {
        phase: "move",
        point,
        event,
        screenRect,
        regionTiles: screenRect ? getRenderer().tilesInRect(screenRect) : null,
      });
    }
  }
  function up(event) {
    if (!drag || event.pointerId !== drag.id) return;
    if ((!drag.pan || drag.emptyPan) && !drag.orbit) {
      const inside = pointAt(event);
      const point =
        inside && drag.point?.elevation !== undefined && !props.placementModel
          ? {
              ...getRenderer().world(event, drag.point.elevation),
              elevation: drag.point.elevation,
            }
          : inside;
      emit("gesture", { phase: point ? "end" : "cancel", point, event });
    }
    drag = null;
    host.value.releasePointerCapture(event.pointerId);
  }
  function cancel(event) {
    if (drag && !drag.pan && !drag.orbit)
      emit("gesture", { phase: "cancel", event });
    drag = null;
  }
  function leave(event) {
    if (!drag) emit("gesture", { phase: "hover", hit: null, event });
  }
  onBeforeUnmount(() => {
    drag = null;
  });
  return { down, move, up, cancel, leave, pointAt };
}
