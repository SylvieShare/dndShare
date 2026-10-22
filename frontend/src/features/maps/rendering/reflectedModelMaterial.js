// A reflected object reverses the handedness of its tangent frame. Three's
// vertex tangent path rebuilds B=cross(N,T)*w without the object determinant.
// Correct that extra reflection without altering shared geometry or textures.
export function reflectedModelMaterial(material, reflected) {
  if (!reflected) return material;
  const before = material.onBeforeCompile;
  const key = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    before.call(material, shader, renderer);
    shader.vertexShader = shader.vertexShader.replace(
      "#include <normal_vertex>",
      `#include <normal_vertex>
#if defined(USE_TANGENT) && !defined(FLAT_SHADED)
  vBitangent = -vBitangent;
#endif`,
    );
  };
  material.customProgramCacheKey = () => `${key}:reflected-tangent-v1`;
  return material;
}
