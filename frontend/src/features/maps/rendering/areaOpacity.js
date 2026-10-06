export function applyAreaOpacity(root, opacity) {
  if (opacity >= 1) return;
  const used = new Set();
  root.traverse((node) => {
    for (const material of Array.isArray(node.material)
      ? node.material
      : node.material
        ? [node.material]
        : []) {
      if (used.has(material)) continue;
      used.add(material);
      material.opacity *= opacity;
      material.transparent = true;
      material.depthWrite = false;
    }
  });
}
