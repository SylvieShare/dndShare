import { DoubleSide, MeshBasicMaterial } from "three";

// Reuse the projected surface and its alpha. The outline mask encodes a style
// in RGB, so coloured ink must not tint those channels.
export function decalOutlineMaterial(texture) {
  const material = new MeshBasicMaterial({
    map: texture,
    alphaTest: 0.065,
    toneMapped: false,
    side: DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      "#include <map_fragment>\ndiffuseColor.rgb = diffuse;",
    );
  };
  return material;
}

export function styleDecalOutline(record, options) {
  const decal = record.decal,
    selected = decal.preview || options.selectedDecal === decal.id;
  record.root.userData.outlineStyle = selected ? "selected" : "hover";
  if (decal.valid === false) record.mask.color.setRGB(1, 1, 1);
  else record.mask.color.setRGB(0, 0, selected ? 1 : 0.55);
  record.mask.opacity = record.material.opacity;
}
