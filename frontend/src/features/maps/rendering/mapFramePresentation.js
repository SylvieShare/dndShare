export function createMapFramePresentation({
  outline,
  scene,
  camera,
  annotations,
  preview,
  objectPreview,
  tiles,
  lighting,
  framePreview,
  canvas,
  objectLayer,
  profiler,
  effects,
  decals,
}) {
  return (objects, options, appearance, frameDepth) => {
    for (const object of objects.children) {
      const { tokenId, objectId } = object.userData;
      object.userData.outlineType = "object";
      object.userData.outlineStyle =
        object.userData.invalidSurface ? "invalid" : (tokenId
          ? tokenId === options.selectedToken
          : objectId && (objectId === options.selectedObject ||
            options.selectedObjects?.includes(objectId)))
          ? "selected"
          : "hover";
    }
    outline.render(
      scene,
      camera,
      annotations.root,
      [
        preview.root,
        objectPreview.root,
        ...(decals?.outlineSources() || []),
        ...objectLayer.outlineSources(
          objects.children.filter(
            (o) =>
              options.master &&
              o.visible &&
              (o.userData.tokenId
                ? [options.selectedToken, options.hoveredToken].includes(o.userData.tokenId)
                : !appearance.hiddenObjects.has(o.userData.objectId) &&
              o.userData.objectId && [
                ...(options.selectedObjects || []),
                options.selectedObject,
                options.hoveredObject,
              ].includes(o.userData.objectId)),
          ),
        ),
      ],
      tiles.transform,
      [...lighting.excluded, ...(decals ? [decals.root] : [])],
      frameDepth,
      effects.outlineOccluders(),
    );
    profiler?.mark("previews");
    framePreview.copy(canvas, lighting.position);
  };
}
