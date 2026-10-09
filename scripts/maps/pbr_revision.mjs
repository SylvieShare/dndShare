import { appendEmbeddedImage } from "./glb_textures.mjs";
export function setSurfaceAtlas(glb, slot, bytes) {
  const surface = glb.json.materials.filter(
    (m) => m.pbrMetallicRoughness?.baseColorTexture,
  );
  if (surface.length !== 1) throw new Error("One baked body material required");
  const mat = surface[0],
    pbr = mat.pbrMetallicRoughness;
  const existing =
    slot === "BaseColor"
      ? pbr.baseColorTexture
      : slot === "Normal"
        ? mat.normalTexture
        : pbr.metallicRoughnessTexture;
  let index;
  if (existing) index = glb.json.textures[existing.index].source;
  else {
    index = appendEmbeddedImage(glb, bytes);
    const baseTexture = glb.json.textures[pbr.baseColorTexture.index],
      texture = glb.json.textures.length;
    glb.json.textures.push({
      source: index,
      ...(baseTexture.sampler !== undefined
        ? { sampler: baseTexture.sampler }
        : {}),
    });
    const info = { ...structuredClone(pbr.baseColorTexture), index: texture };
    if (slot !== "MetallicRoughness")
      throw new Error("Only missing ORM is supported");
    pbr.metallicRoughnessTexture = info;
  }
  if (slot === "MetallicRoughness") {
    pbr.roughnessFactor = 1;
    pbr.metallicFactor = 1;
    mat.occlusionTexture = structuredClone(pbr.metallicRoughnessTexture);
  }
  return index;
}

// For a source-rebuilt body whose previous resource used vertex colours only.
export function initializeUntexturedSurfaceAtlas(glb, bytes) {
  if (
    (glb.json.materials ?? []).some(
      (m) => m.pbrMetallicRoughness?.baseColorTexture,
    )
  )
    return false;
  const bodies = glb.json.materials.filter(
    (m) => m.name !== "Simple insertion pegs",
  );
  if (bodies.length !== 1)
    throw new Error("One untextured rebuilt body required");
  const mat = bodies[0],
    pbr = (mat.pbrMetallicRoughness ??= {});
  glb.json.images ??= [];
  glb.json.textures ??= [];
  const info = () => {
    const source = appendEmbeddedImage(glb, bytes),
      index = glb.json.textures.length;
    glb.json.textures.push({ source });
    return { index };
  };
  pbr.baseColorFactor = [1, 1, 1, 1];
  pbr.baseColorTexture = info();
  mat.normalTexture = info();
  pbr.metallicRoughnessTexture = info();
  return true;
}
