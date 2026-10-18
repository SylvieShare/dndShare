import { Matrix4, Vector3 } from "three";

const declarations = `
uniform float modelFireTime;
uniform float modelFireMotion;
uniform float modelFirePhase;
varying float modelFireHeight;
varying float modelFireSeed;
varying float modelFireRegion;
`;

const deformation = `
vec3 firePoint = (modelFireFrame * vec4(transformed, 1.0)).xyz;
vec3 fireOffset = firePoint - modelFireOrigin;
float fireHeight = clamp(fireOffset.y / 0.35, 0.0, 1.0);
modelFireRegion = (1.0 - smoothstep(0.08, 0.105, length(fireOffset.xz)))
  * smoothstep(0.12, 0.23, fireOffset.y);
float fireWeight = modelFireRegion * modelFireMotion;
float fireSeed = modelFirePhase;
#ifdef USE_INSTANCING
  fireSeed += float(gl_InstanceID) * 2.399963;
#endif
float fireTime = modelFireTime;
firePoint.x += fireWeight * (
  0.047 * sin(fireTime * 7.3 + fireHeight * 5.0 + fireSeed)
  + 0.019 * sin(fireTime * 13.1 - fireHeight * 8.0 + fireSeed));
firePoint.z += fireWeight * 0.035 * sin(fireTime * 8.7 + fireHeight * 6.0 + fireSeed);
firePoint.y += fireWeight * (
  0.055 * sin(fireTime * 9.1 + fireSeed)
  + 0.025 * sin(fireTime * 15.3 + fireHeight * 9.0 + fireSeed));
if (fireWeight > 0.0)
  transformed = (modelFireInverse * vec4(firePoint, 1.0)).xyz;
modelFireHeight = fireHeight;
modelFireSeed = fireSeed;
`;

const glow = `
float fireMask = modelFireRegion * step(0.1, dot(totalEmissiveRadiance, vec3(0.333333)));
float fireHeat = 0.5 + 0.5 * sin(
  modelFireHeight * 21.0 - modelFireTime * 11.0 + modelFireSeed);
float fireBlend = fireMask * modelFireMotion;
totalEmissiveRadiance *= mix(1.0, 0.75 + fireHeat * 0.7, fireBlend);
diffuseColor.rgb = mix(diffuseColor.rgb,
  mix(vec3(1.0, 0.09, 0.008), vec3(1.0, 0.66, 0.06), fireHeat),
  fireBlend * 0.45);
`;

// Work in the model frame, including quantized GLB node transforms. The region
// starts above the fuel and stays inside the iron basket's inner radius.
export function modelFireShader(
  material, frame = new Matrix4(), top = 2.427057, phase = 0,
) {
  const uniforms = {
    modelFireTime: { value: 0 },
    modelFireMotion: { value: 0 },
    modelFirePhase: { value: phase },
    modelFireFrame: { value: frame.clone() },
    modelFireInverse: { value: frame.clone().invert() },
    modelFireOrigin: { value: new Vector3(-0.322429, top - 0.35, -0.294429) },
  };
  const before = material.onBeforeCompile,
    programKey = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    before.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>
${declarations}
uniform mat4 modelFireFrame;
uniform mat4 modelFireInverse;
uniform vec3 modelFireOrigin;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${deformation}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${declarations}`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n${glow}`);
  };
  material.customProgramCacheKey = () => `${programKey}:mt1-torch-fire-v1`;
  return uniforms;
}
