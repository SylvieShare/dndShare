const fields = new Set([
  "name",
  "tileType",
  "maxHeight",
  "surfaceHeight",
  "placementPoints",
  "mountDepth",
  "canStand",
]);
export function correctedCaveModel(model, source, spec, explicit) {
  const correction = spec.geometryCorrection;
  if (!correction)
    return { model: structuredClone(model), cutHeight: source.cutHeight };
  if (!explicit)
    throw new Error(
      "Inspect the full source and explicitly enable geometry correction",
    );
  const removeMount = correction.mode === "remove-false-mount";
  if (correction.mode && !removeMount)
    throw new Error("Unknown reviewed geometry correction mode");
  if (
    typeof correction.reason !== "string" ||
    correction.reason.trim().length < 30 ||
    !model.definitionId ||
    correction.sourceSHA256 !== model.assets.source.sha256 ||
    correction.sourceSHA256 !== source.sourceSHA256 ||
    correction.previousCutHeightMM !== source.cutHeight ||
    (removeMount
      ? correction.cutHeightMM !== source.cutHeight ||
        source.cutHeight <= 0 ||
        !Number.isFinite(source.mountDepth) ||
        source.mountDepth <= 0
      : correction.cutHeightMM !== 0 || model.mountDepth !== 0)
  )
    throw new Error(
      "Reviewed source correction with unchanged original identity required",
    );
  for (const key of Object.keys(correction.metadata))
    if (
      !fields.has(key) ||
      (!removeMount && ["mountDepth", "canStand"].includes(key))
    )
      throw new Error("Unexpected correction metadata: " + key);
  if (
    ![0, 180].includes(correction.rotationXDeg ?? 0) ||
    (model.placementPoints?.length &&
      !Object.hasOwn(correction.metadata, "placementPoints"))
  )
    throw new Error(
      "Restored orientation and existing placement points require explicit review",
    );
  const result = { ...structuredClone(model), ...correction.metadata };
  if (
    removeMount &&
    (correction.rotationXDeg ||
      result.mountDepth !== source.mountDepth ||
      result.tileType !== model.tileType ||
      model.tileType !== "floor" ||
      result.canStand !== false ||
      result.placementPoints?.length !== 0 ||
      model.supportSlots?.length ||
      !Object.hasOwn(correction.metadata, "placementPoints"))
  )
    throw new Error(
      "False hole mounting correction requires the native mounting datum, a slotless floor and no standing point",
    );
  if (
    !Number.isFinite(result.maxHeight) ||
    !Number.isFinite(result.surfaceHeight) ||
    result.surfaceHeight < 0 ||
    Math.abs(result.maxHeight - (source.max[2] - correction.cutHeightMM) / 35) >
      0.0001 ||
    result.surfaceHeight > result.maxHeight ||
    (!removeMount && result.tileType !== "object")
  )
    throw new Error(
      "Corrected heights must match the source after its declared cut",
    );
  if (
    result.placementPoints?.some(
      (p) =>
        ![p.x, p.y, p.elevation].every(Number.isFinite) ||
        p.x < 0 ||
        p.y < 0 ||
        p.x > result.width ||
        p.y > result.height ||
        p.elevation < 0 ||
        p.elevation > result.maxHeight,
    )
  )
    throw new Error(
      "Corrected placement points must lie inside the restored object",
    );
  return {
    model: result,
    cutHeight: correction.cutHeightMM,
    correction: {
      ...structuredClone(correction),
      rotationOriginZMM: source.max[2],
    },
  };
}
