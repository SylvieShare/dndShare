// Keep historical UUIDs in the renderer catalogue, but offer one current tile
// per named source variant. UD-055 contains two distinct original models.
export function latestModelVersions(catalogue) {
  const latest = new Map();
  for (const model of catalogue) {
    if (model.hidden) continue;
    const key = JSON.stringify([
      model.collection,
      model.sourceCode,
      model.sourceName,
    ]);
    const old = latest.get(key);
    if (!old || (model.version || 1) > (old.version || 1))
      latest.set(key, model);
  }
  return [...latest.values()];
}
