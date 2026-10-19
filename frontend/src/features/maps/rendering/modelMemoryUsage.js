// Geometry buffers are measured; texture residency is an estimate, not browser heap usage.
export function modelMemoryUsage(parts) {
  const buffers = new Set(),
    geometries = new Set(),
    textures = new Set();
  let geometryBytes = 0,
    textureBytes = 0,
    triangles = 0;
  for (const { geometry, material } of parts) {
    if (!geometries.has(geometry))
      geometryBytes += geometry.userData?.bvhBytes || 0;
    geometries.add(geometry);
    const attrs = [
      ...Object.values(geometry.attributes || {}),
      geometry.index,
      ...Object.values(geometry.morphAttributes || {}).flat(),
    ];
    for (const attribute of attrs) {
      const array = attribute?.isInterleavedBufferAttribute
        ? attribute.data.array
        : attribute?.array;
      const buffer = array?.buffer;
      if (buffer && !buffers.has(buffer)) {
        buffers.add(buffer);
        geometryBytes += buffer.byteLength;
      }
    }
    triangles +=
      (geometry.index?.count || geometry.attributes?.position?.count || 0) / 3;
    for (const m of Array.isArray(material) ? material : [material])
      for (const value of Object.values(m || {}))
        if (value?.isTexture) textures.add(value);
  }
  for (const texture of textures) {
    const mips = texture.mipmaps || [];
    const bytes = mips.reduce((n, mip) => n + (mip.data?.byteLength || 0), 0);
    const image = texture.source?.data || texture.image;
    const images = Array.isArray(image) ? image : [image];
    textureBytes +=
      bytes ||
      images.reduce(
        (n, i) =>
          n + (i?.data?.byteLength || (i?.width || 0) * (i?.height || 0) * 4),
        0,
      ) * (texture.generateMipmaps ? 4 / 3 : 1);
  }
  return {
    geometryBytes,
    textureBytes: Math.ceil(textureBytes),
    triangles: Math.round(triangles),
  };
}
export function residentModelUsage(owned, catalogue) {
  const kinds = new Map(
    ["render", "lod", "shadow"].map((kind) => [kind, new Set()]),
  );
  const sizes = new Map();
  for (const model of catalogue.values())
    for (const kind of kinds.keys()) {
      const url = model[`${kind}Url`];
      if (url) {
        kinds.get(kind).add(url);
        sizes.set(
          url,
          Math.max(sizes.get(url) || 0, model.assetBytes?.[kind] || 0),
        );
      }
    }
  const result = {
    files: 0,
    fileBytes: 0,
    geometryBytes: 0,
    textureBytes: 0,
    triangles: 0,
    groups: [],
  };
  const assigned = new Set();
  for (const [kind, urls] of kinds) {
    const group = { kind, files: 0, fileBytes: 0 };
    for (const url of urls) {
      const value = owned.get(url)?.value;
      if (!value || assigned.has(url)) continue;
      assigned.add(url);
      group.files++;
      group.fileBytes += sizes.get(url) || value.fileBytes || 0;
      for (const key of ["geometryBytes", "textureBytes", "triangles"])
        result[key] += value.usage?.[key] || 0;
    }
    result.files += group.files;
    result.fileBytes += group.fileBytes;
    if (group.files) result.groups.push(group);
  }
  return result;
}
