// Pending deletes are an optimistic overlay; stale REST/SSE reads cannot restore them.
export function sessionMapRemoval({
  maps,
  selectedID,
  display,
  request,
  notify,
  settled,
}) {
  const pending = new Map();
  let epoch = 0;
  function remove(id) {
    const index = maps.value.findIndex((m) => m.id === id);
    if (index < 0 || pending.has(id)) return false;
    const map = maps.value[index],
      beforeDisplay = display.value;
    const item = { map, index };
    pending.set(id, item);
    epoch++;
    maps.value = maps.value.filter((m) => m.id !== id);
    let optimisticDisplay;
    if (display.value?.mapId === id) {
      display.value = {
        ...display.value,
        mapId: null,
        visible: false,
        camera: { ...display.value.camera, sceneId: "", view: null, fit: true },
      };
      optimisticDisplay = display.value;
    }
    item.promise = Promise.resolve()
      .then(() => request(id))
      .then(
        () => true,
        (error) => {
          if (!maps.value.some((m) => m.id === id)) {
            const restored = [...maps.value];
            restored.splice(Math.min(index, restored.length), 0, map);
            maps.value = restored;
          }
          if (!selectedID.value) selectedID.value = id;
          if (optimisticDisplay && display.value === optimisticDisplay)
            display.value = beforeDisplay;
          notify(map, error);
          return false;
        },
      )
      .then((success) => {
        pending.delete(id);
        epoch++;
        settled(success);
      });
    if (selectedID.value === id) selectedID.value = maps.value[0]?.id || "";
    return true;
  }
  return {
    pending,
    remove,
    get epoch() {
      return epoch;
    },
    wait: () => Promise.all([...pending.values()].map((item) => item.promise)),
  };
}
