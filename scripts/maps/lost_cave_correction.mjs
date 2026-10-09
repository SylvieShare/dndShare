const fields = new Set([
  "name",
  "tileType",
  "maxHeight",
  "surfaceHeight",
  "placementPoints",
  "mountDepth",
  "canStand",
  "hasDecor",
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
  const restoreBridge = correction.mode === "restore-native-bridge";
  const restoreWell = correction.mode === "restore-native-well";
  if (correction.mode && !removeMount && !restoreBridge && !restoreWell)
    throw new Error("Unknown reviewed geometry correction mode");
  if (
    typeof correction.reason !== "string" ||
    correction.reason.trim().length < 30 ||
    !model.definitionId ||
    correction.sourceSHA256 !== model.assets.source.sha256 ||
    correction.sourceSHA256 !== source.sourceSHA256 ||
    correction.previousCutHeightMM !== source.cutHeight ||
    (removeMount || restoreWell
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
      (!removeMount && !restoreWell && ["mountDepth", "canStand"].includes(key))
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
    restoreWell &&
    (!["LC-067", "LC-068"].includes(model.sourceCode) ||
      !["wall-straight", "floor"].includes(model.tileType) ||
      result.tileType !== model.tileType ||
      result.mountDepth !== model.mountDepth ||
      model.mountDepth !== source.mountDepth ||
      result.width !== 1 ||
      result.height !== 1 ||
      (model.sourceCode === "LC-068"
        ? result.canStand !== false || result.placementPoints?.length !== 0
        : result.canStand !== model.canStand ||
          JSON.stringify(result.placementPoints) !==
            JSON.stringify(model.placementPoints)) ||
      result.hasDecor !== true ||
      model.supportSlots?.length ||
      correction.rotationXDeg)
  )
    throw new Error(
      "Native well restoration requires the reviewed hollow1x1 well, unchanged datum and placement",
    );
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
    restoreBridge &&
    (model.tileType !== "bridge" ||
      source.mountDepth !== 0 ||
      source.cutHeight <= 0 ||
      correction.rotationXDeg ||
      model.supportSlots?.length)
  )
    throw new Error(
      "Native bridge restoration requires a slotless bridge without mounting or rotation",
    );
  if (
    !Number.isFinite(result.maxHeight) ||
    !Number.isFinite(result.surfaceHeight) ||
    result.surfaceHeight < 0 ||
    Math.abs(result.maxHeight - (source.max[2] - correction.cutHeightMM) / 35) >
      0.0001 ||
    result.surfaceHeight > result.maxHeight ||
    (!removeMount &&
      !restoreWell &&
      result.tileType !== (restoreBridge ? model.tileType : "object"))
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
