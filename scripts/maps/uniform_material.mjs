// Flat technical parts can retain their exact mesh without redundant image maps.
export function uniformMaterialSettings(settings) {
  const { srgb, roughness, metallic = 0 } = settings;
  if (!Array.isArray(srgb) || srgb.length !== 3 ||
      [...srgb, roughness, metallic].some(v => !Number.isFinite(v) || v < 0 || v > 1))
    throw new Error('Uniform PBR requires finite RGB, roughness and metallic in0..1');
  const linear = srgb.map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return { srgb, linear, roughness, metallic };
}

export function applyUniformMaterial(doc, settings) {
  const result = uniformMaterialSettings(settings);
  for (const mat of doc.getRoot().listMaterials())
    mat.setBaseColorTexture(null).setNormalTexture(null)
      .setMetallicRoughnessTexture(null).setOcclusionTexture(null)
      .setEmissiveTexture(null).setEmissiveFactor([0, 0, 0])
      .setBaseColorFactor([...result.linear, 1])
      .setMetallicFactor(result.metallic).setRoughnessFactor(result.roughness);
  for (const mesh of doc.getRoot().listMeshes())
    for (const primitive of mesh.listPrimitives())
      for (const name of primitive.listSemantics())
        if (/^(COLOR_|TEXCOORD_)/.test(name) || name === 'TANGENT')
          primitive.setAttribute(name, null);
  for (const texture of doc.getRoot().listTextures()) texture.dispose();
  for (const extension of doc.getRoot().listExtensionsUsed())
    if (extension.extensionName === 'KHR_texture_basisu') extension.dispose();
  return result;
}

export function assertUniformMaterial(doc, settings) {
  const result = uniformMaterialSettings(settings), materials = doc.getRoot().listMaterials();
  if (!materials.length || doc.getRoot().listTextures().length)
    throw new Error('Uniform material must have materials and no image dependencies');
  for (const mat of materials) {
    if (mat.getBaseColorFactor().some((v, i) => Math.abs(v - [...result.linear, 1][i]) > 1e-6) ||
        Math.abs(mat.getMetallicFactor() - result.metallic) > 1e-6 ||
        Math.abs(mat.getRoughnessFactor() - result.roughness) > 1e-6)
      throw new Error('Uniform PBR factors changed');
  }
  for (const mesh of doc.getRoot().listMeshes())
    for (const primitive of mesh.listPrimitives()) {
      if (primitive.listSemantics().some(name => /^(COLOR_|TEXCOORD_)/.test(name) || name === 'TANGENT'))
        throw new Error('Uniform mesh retains unused material attributes');
      const normals = primitive.getAttribute('NORMAL');
      if (!normals) throw new Error('Uniform mesh lost its geometric normals');
      for (let i = 0; i < normals.getCount(); i++) {
        const length = Math.hypot(...normals.getElement(i, []));
        if (!Number.isFinite(length) || Math.abs(length - 1) > .02)
          throw new Error('Invalid uniform mesh normal');
      }
    }
  return result;
}
