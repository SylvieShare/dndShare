const bases = new WeakMap();
const roots = new WeakMap();

export function isFadingAreaSurface(material) {
  const base = bases.get(material);
  return !!base && !base.transparent && base.depthWrite && material.transparent;
}

export function applyAreaOpacity(root, opacity, brightness = 1) {
  root.visible = opacity > 0.001;
  const old = roots.get(root);
  const child = root.children[0];
  if (
    old &&
    old.opacity === opacity &&
    old.brightness === brightness &&
    old.material === root.material &&
    old.child === child &&
    old.count === root.children.length
  )
    return;
  roots.set(root, {
    opacity,
    brightness,
    material: root.material,
    child,
    count: root.children.length,
  });
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
          flash: { value: 0 },
        };
        bases.set(material, base);
        const before = material.onBeforeCompile,
          programKey = material.customProgramCacheKey();
        material.onBeforeCompile = (shader, renderer) => {
          before.call(material, shader, renderer);
          shader.uniforms.mapAreaFlash = base.flash;
          shader.fragmentShader = shader.fragmentShader
            .replace(
              "#include <common>",
              "#include <common>\nuniform float mapAreaFlash;",
            )
            .replace(
              "#include <opaque_fragment>",
              `
outgoingLight = outgoingLight * (1.0 + mapAreaFlash) + vec3(mapAreaFlash * 0.35);
#include <opaque_fragment>`,
            );
        };
        material.customProgramCacheKey = () => `${programKey}:area-flash-v1`;
        material.needsUpdate = true;
      }
      const transparent = base.transparent || opacity < 0.999;
      if (material.transparent !== transparent) {
        material.transparent = transparent;
        material.needsUpdate = true;
      }
      material.opacity = base.opacity * opacity;
      material.depthWrite = base.depthWrite && opacity >= 0.999;
      base.flash.value = Math.max(0, brightness - 1);
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
