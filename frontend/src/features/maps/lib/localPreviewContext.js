export async function localPreviewContext(map, catalogue) {
  if (
    !map.document ||
    !map.previewSignature ||
    !map.previewModelsSignature ||
    !catalogue
  )
    return null;
  const ids = new Set([
    ...map.document.tiles.map((tile) => tile.modelId),
    ...map.document.objects.map((object) => object.modelId).filter(Boolean),
  ]);
  const models = catalogue.filter((model) => ids.has(model.id));
  if (
    models.length !== ids.size ||
    models.some((model) => !model.previewSignature)
  )
    return null;
  const pairs = models
    .map((model) => [model.id, model.previewSignature])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(pairs)),
  );
  const signature = [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return signature === map.previewModelsSignature
    ? { document: map.document, models, signature: map.previewSignature }
    : null;
}
