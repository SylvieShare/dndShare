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
}) {
  return (objects, options, appearance) => {
    for (const object of objects.children) {
      object.userData.outlineType = "object";
      object.userData.outlineStyle =
        object.userData.objectId === options.selectedObject ||
        options.selectedObjects?.includes(object.userData.objectId)
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
        ...objectLayer.outlineSources(
          objects.children.filter(
            (o) =>
              options.master &&
              o.visible &&
              !appearance.hiddenObjects.has(o.userData.objectId) &&
              o.userData.objectId &&
              [
                ...(options.selectedObjects || []),
                options.selectedObject,
                options.hoveredObject,
              ].includes(o.userData.objectId),
          ),
        ),
      ],
      tiles.transform,
      lighting.excluded,
    );
    profiler?.mark("previews");
    framePreview.copy(canvas, lighting.position);
  };
}
