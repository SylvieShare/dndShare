import { onMounted, onBeforeUnmount } from "vue";

export function useMapCanvasPointer(host, props, getRenderer, emit, setView) {
  let drag = null,
    holdTimer;
  function clearHold() {
    clearTimeout(holdTimer);
    holdTimer = null;
  }
  function start(event) {
    drag.started = true;
    emit("gesture", {
      phase: "start",
      point: drag.point,
      hit: drag.hit,
      event,
    });
  }
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
    if (
      props.placementLight ||
      (props.selectedLight && drag && !drag.pan && !drag.orbit)
    )
      return getRenderer().lightPoint(event);
    if (
      props.document.kind === "tiles" &&
      (props.placementObject ||
        props.surfacePlacement ||
        (props.previewObject?.modelId &&
          props.previewObject?.placing &&
          !props.previewTile))
    ) {
      return (
        getRenderer().surfacePoint(
          event,
          props.previewObject?.moving ? props.previewObject.id : "",
        ) || { ...getRenderer().world(event), invalidSurface: true }
      );
    }
    return (
      getRenderer().placementPoint?.(
        event,
        props.placementModel,
        props.placementHint ||
          props.previewTile || { rotation: props.placementRotation || 0 },
      ) || getRenderer().world(event)
    );
  }
  function down(event) {
    if (props.readonly || !getRenderer() || drag) return;
    if (props.tool === "paste" && event.button === 2) {
      event.preventDefault();
      emit("gesture", { phase: "cancel", event });
      return;
    }
    host.value.focus({ preventScroll: true });
    host.value.setPointerCapture(event.pointerId);
    const hit = getRenderer().pick(event);
    const additive = event.metaKey || event.ctrlKey;
    const delayed =
      props.holdToDrag &&
      props.tool === "select" &&
      event.button === 0 &&
      !additive &&
      !event.altKey &&
      !event.shiftKey;
    drag = {
      id: event.pointerId,
      hit,
      delayed,
      started: false,
      moved: false,
      orbit: event.button === 2 || event.shiftKey,
      pan:
        delayed ||
        event.button === 1 ||
        event.altKey ||
        props.tool === "pan" ||
        (props.tool === "select" &&
          event.button === 0 &&
          !additive &&
          (!hit || hit.anchor)),
      emptyPan:
        props.tool === "select" &&
        event.button === 0 &&
        !additive &&
        (!hit || hit.anchor),
      screen: { x: event.clientX, y: event.clientY },
      point:
        props.tool === "paste" ||
        props.placementObject ||
        props.surfacePlacement ||
        props.placementLight ||
        hit?.lightId
          ? pointAt(event)
          : hit?.point || pointAt(event),
      view: getRenderer().getView(),
      region: !!props.selectedTiles && props.tool === "select" && additive,
    };
    if (delayed && (hit?.tileId || hit?.objectId || hit?.lightId)) {
      holdTimer = setTimeout(() => {
        if (!drag || drag.moved) return;
        drag.pan = false;
        start(event);
        emit("gesture", { phase: "hold", point: drag.point, hit, event });
      }, 500);
    } else if (!delayed && (!drag.pan || drag.emptyPan) && !drag.orbit)
      start(event);
  }
  function move(event) {
    if (!getRenderer() || props.readonly) return;
    const point =
      !props.selectedLight &&
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
    if (
      Math.hypot(
        event.clientX - drag.screen.x,
        event.clientY - drag.screen.y,
      ) >= 5
    ) {
      drag.moved = true;
      clearHold();
    }
    if (drag.delayed && drag.pan && !drag.moved) return;
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
    clearHold();
    if (drag.delayed && !drag.started && !drag.moved) start(event);
    if (drag.started && !drag.orbit) {
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
    clearHold();
    if (drag?.started && !drag.orbit)
      emit("gesture", { phase: "cancel", event });
    if (drag && host.value?.hasPointerCapture?.(drag.id))
      host.value.releasePointerCapture(drag.id);
    drag = null;
  }
  function leave(event) {
    if (!drag) emit("gesture", { phase: "hover", hit: null, event });
  }
  function key(event) {
    if (event.key === "Escape") cancel(event);
  }
  onMounted(() => {
    window.addEventListener("blur", cancel);
    window.addEventListener("keydown", key);
  });
  onBeforeUnmount(() => {
    clearHold();
    drag = null;
    window.removeEventListener("blur", cancel);
    window.removeEventListener("keydown", key);
  });
  return { down, move, up, cancel, leave, pointAt };
}
