export function includePreparedVariant(seen, model) {
  const key = JSON.stringify([
    model.collection,
    model.sourceCode,
    model.sourceName,
  ]);
  if (seen.has(key))
    throw new Error("More than one prepared revision selected: " + key);
  seen.add(key);
}
export function preservedRevisionAssets(model, preparedShadow) {
  if (!model.assets.shadow)
    throw new Error("Refresh the prepared baseline: shadow asset is required");
  return {
    source: model.assets.source,
    shadow: preparedShadow?.asset ?? model.assets.shadow,
  };
}
