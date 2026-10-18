const bases = new WeakMap();

export function isFadingAreaSurface(material) {
  const base = bases.get(material);
  return !!base && !base.transparent && base.depthWrite && material.transparent;
}

export function applyAreaOpacity(root, opacity, brightness = 1) {
  root.visible = opacity > 0.001;
  const used = new Set();
  root.traverse((node) => {
    const materials = Array.isArray(node.material)
      ? node.material
      : node.material
        ? [node.material]
        : [];
    for (const material of materials) {
      if (used.has(material)) continue;
      used.add(material);
      let base = bases.get(material);
      if (!base) {
        base = {
          opacity: material.opacity,
          transparent: material.transparent,
          depthWrite: material.depthWrite,
          color: material.color?.clone(),
          emissive: material.emissive?.clone(),
        };
        bases.set(material, base);
      }
      const transparent = base.transparent || opacity < 0.999;
      if (material.transparent !== transparent) {
        material.transparent = transparent;
        material.needsUpdate = true;
      }
      material.opacity = base.opacity * opacity;
      material.depthWrite = base.depthWrite && opacity >= 0.999;
      if (base.color)
        material.color.copy(base.color).multiplyScalar(brightness);
      if (base.emissive) {
        material.emissive.copy(base.emissive);
        if (base.color) {
          const boost = (brightness - 1) * 0.12;
          material.emissive.r += base.color.r * boost;
          material.emissive.g += base.color.g * boost;
          material.emissive.b += base.color.b * boost;
        }
      }
    }
  });
}
export function applySceneAreaAppearance(root, appearance) {
  for (const node of root.children) {
    const id = node.userData.objectId,
      tileId = node.userData.placementTileId;
    if (id)
      applyAreaOpacity(
        node,
        appearance.objectOpacity(id),
        appearance.objectFlash(id),
      );
    else if (node.userData.tokenId)
      applyAreaOpacity(
        node,
        appearance.tokenOpacity(tileId),
        appearance.tileFlash(tileId),
      );
  }
}
