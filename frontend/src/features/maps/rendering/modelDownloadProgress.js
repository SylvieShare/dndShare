export function modelFile(model, kind) {
  const url = model?.[`${kind}Url`];
  return url
    ? {
        url,
        kind,
        bytes: model.assetBytes?.[kind] || 0,
        fallbackUrl: kind === "lod" ? model.renderUrl : "",
      }
    : null;
}
export function modelDownloadPlan(
  catalogue,
  ids,
  tier,
  details,
  shadows,
  shadowIds = ids,
) {
  const plan = new Map();
  function add(id, kind) {
    const file = modelFile(catalogue.get(id), kind);
    if (file && !plan.has(file.url)) plan.set(file.url, file);
    if (file && kind === "shadow") plan.get(file.url).requiredForShadow = true;
  }
  for (const id of ids) {
    add(id, "lod");
    if (tier === "render") add(id, "render");
  }
  for (const id of details) add(id, "render");
  if (shadows)
    for (const id of new Set([...shadowIds, ...details])) add(id, "shadow");
  return plan;
}
const kinds = ["render", "lod", "shadow", "other"];
export function modelDownloadProgress(files, stateFor) {
  const result = {
    total: 0,
    ready: 0,
    remaining: 0,
    active: 0,
    queued: 0,
    processing: 0,
    failed: 0,
    totalBytes: 0,
    loadedBytes: 0,
    remainingBytes: 0,
    unknown: 0,
  };
  const groups = new Map(kinds.map((kind) => [kind, { ...result, kind }]));
  for (const file of files) {
    const state = stateFor(file.url) || { status: "queued" };
    const ready = state.status === "ready";
    const total = Math.max(
      0,
      file.bytes || 0,
      state.total || 0,
      state.loaded || 0,
    );
    const loaded = ready
      ? total
      : state.status === "failed"
        ? 0
        : Math.min(total, state.loaded || 0);
    const row = {
      total: 1,
      ready: +ready,
      remaining: +!ready,
      active: +["loading", "processing"].includes(state.status),
      queued: +["queued", "cancelled"].includes(state.status),
      processing: +(state.status === "processing"),
      failed: +(state.status === "failed"),
      totalBytes: total,
      loadedBytes: loaded,
      remainingBytes: total - loaded,
      unknown: +(!ready && !total),
    };
    const group = groups.get(file.kind) || groups.get("other");
    for (const key of Object.keys(result)) {
      result[key] += row[key];
      group[key] += row[key];
    }
  }
  result.groups = [...groups.values()].filter((g) => g.total);
  return result;
}
