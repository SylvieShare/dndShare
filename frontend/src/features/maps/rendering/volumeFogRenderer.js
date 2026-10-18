import { createScalarMotion, reducedMapMotion } from "./scalarMotion";
import { renderAreaSurfaces } from "./areaSurfaceRenderer";
import {
  Color,
  DepthTexture,
  HalfFloatType,
  Matrix4,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  UnsignedIntType,
  Vector2,
  Vector3,
  WebGLRenderTarget,
} from "three";
import {
  buildVolumeFogField,
  volumeFogColumns,
  applyVolumeFogWeights,
} from "./volumeFogField";
import { fogDataTexture, fogNoiseTexture } from "./volumeFogTextures";
import {
  fogVertex,
  volumeFogFragment,
  fogCompositeFragment,
} from "./volumeFogShaders";

export function createVolumeFog(gpu, visibility, motion) {
  const quadGeometry = new PlaneGeometry(2, 2),
    camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const fogScene = new Scene(),
    compositeScene = new Scene(),
    size = new Vector2();
  const skyMotion = createScalarMotion();
  const fogUniforms = {
    ...visibility,
    sceneDepth: { value: null },
    densityField: { value: null },
    noiseField: { value: null },
    inverseViewProjection: { value: new Matrix4() },
    rayDirection: { value: new Vector3() },
    boundsMin: { value: new Vector3() },
    boundsSize: { value: new Vector3() },
    sunDirection: { value: new Vector3(-0.4, 0.8, -0.5).normalize() },
    clock: { value: 0 },
    skyLight: { value: 1 },
  };
  const fogMaterial = new ShaderMaterial({
    vertexShader: fogVertex,
    fragmentShader: volumeFogFragment,
    uniforms: fogUniforms,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const compositeUniforms = {
    sceneColour: { value: null },
    sceneDepth: { value: null },
    fogColour: { value: null },
    fogSize: { value: new Vector2() },
    depthRange: { value: 1 },
    backgroundColour: { value: new Color() },
  };
  const compositeMaterial = new ShaderMaterial({
    vertexShader: fogVertex,
    fragmentShader: fogCompositeFragment,
    uniforms: compositeUniforms,
    depthTest: false,
    depthWrite: false,
    toneMapped: true,
  });
  fogScene.add(new Mesh(quadGeometry, fogMaterial));
  compositeScene.add(new Mesh(quadGeometry, compositeMaterial));
  let field = null,
    key = "",
    sceneTarget,
    fogTarget,
    noise,
    areaSettings = new Map(),
    weightsKey = "",
    targetActive = false;
  function releaseTargets() {
    sceneTarget?.dispose();
    fogTarget?.dispose();
    sceneTarget = fogTarget = null;
  }
  function targets() {
    gpu.getDrawingBufferSize(size);
    if (sceneTarget?.width === size.x && sceneTarget?.height === size.y) return;
    releaseTargets();
    sceneTarget = new WebGLRenderTarget(size.x, size.y, {
      type: gpu.extensions.has("EXT_color_buffer_float")
        ? HalfFloatType
        : UnsignedByteType,
      // Keep the extra colour/depth buffers bounded on Retina displays.
      samples: 0,
      depthTexture: new DepthTexture(size.x, size.y, UnsignedIntType),
    });
    fogTarget = new WebGLRenderTarget(
      Math.max(1, Math.ceil(size.x / 2)),
      Math.max(1, Math.ceil(size.y / 2)),
      { depthBuffer: false },
    );
    fogUniforms.sceneDepth.value = sceneTarget.depthTexture;
    compositeUniforms.sceneColour.value = sceneTarget.texture;
    compositeUniforms.sceneDepth.value = sceneTarget.depthTexture;
    compositeUniforms.fogColour.value = fogTarget.texture;
    compositeUniforms.fogSize.value.set(fogTarget.width, fogTarget.height);
  }
  function releaseField() {
    fogUniforms.densityField.value?.dispose();
    fogUniforms.densityField.value = null;
    field = null;
    releaseTargets();
    noise?.dispose();
    noise = null;
    weightsKey = "";
  }
  function updateWeights() {
    if (!field) return;
    const weights = new Map(
      [...field.masks.keys()].map((id) => {
        const area = areaSettings.get(id);
        const amount = motion
          ? motion.fog(id) * motion.visibility(id)
          : area?.fog && !area.hidden
            ? 1
            : 0;
        return [id, Math.round(amount * 255) / 255];
      }),
    );
    const next = JSON.stringify([...weights]);
    if (!targetActive && [...weights.values()].every((n) => n === 0)) {
      releaseField();
      key = "";
      return;
    }
    if (next === weightsKey) return;
    weightsKey = next;
    applyVolumeFogWeights(field, (id) => weights.get(id) || 0);
    fogUniforms.densityField.value.needsUpdate = true;
  }
  return {
    update(document, placed, catalogue, previews) {
      areaSettings = new Map(document.areas.map((a) => [a.id || "", a]));
      targetActive = document.areas.some((a) => a.fog && !a.hidden);
      const columns = volumeFogColumns(
          document,
          placed,
          catalogue,
          previews,
          motion,
        ),
        next = JSON.stringify(columns);
      if (next !== key || (!field && columns.length)) {
        key = next;
        weightsKey = "";
        fogUniforms.densityField.value?.dispose();
        field = buildVolumeFogField(columns);
        fogUniforms.densityField.value = field
          ? fogDataTexture(field.data, field.dimensions)
          : null;
        if (field) {
          noise ||= fogNoiseTexture();
          fogUniforms.noiseField.value = noise;
          fogUniforms.boundsMin.value.fromArray(field.min);
          fogUniforms.boundsSize.value.fromArray(field.size);
        } else {
          releaseTargets();
          noise?.dispose();
          noise = null;
        }
      }
      updateWeights();
      const sun = document.sun;
      skyMotion.set(
        "sky",
        !document.lightingEnabled || sun?.enabled ? 1 : 0.28,
        { immediate: !motion || motion.instant(), duration: 380 },
      );
      fogUniforms.skyLight.value = skyMotion.value("sky");
      if (document.lightingEnabled && sun?.enabled) {
        const angle = (sun.angle * Math.PI) / 180,
          elevation = (sun.elevation * Math.PI) / 180;
        fogUniforms.sunDirection.value.set(
          Math.sin(angle) * Math.cos(elevation),
          Math.sin(elevation),
          Math.cos(angle) * Math.cos(elevation),
        );
      } else fogUniforms.sunDirection.value.set(-0.4, 0.8, -0.5).normalize();
    },
    top: () => field?.max[1] || 0,
    advance(delta, elapsed = delta) {
      skyMotion.advance(delta, reducedMapMotion());
      fogUniforms.skyLight.value = skyMotion.value("sky");
      updateWeights();
      if (!field) return false;
      fogUniforms.clock.value =
        (fogUniforms.clock.value + Math.min(elapsed, 250) / 1000) % 10000;
      return true;
    },
    render(scene, viewCamera) {
      if (!field) {
        renderAreaSurfaces(gpu, scene, viewCamera);
        return;
      }
      targets();
      const previous = gpu.getRenderTarget();
      try {
        fogUniforms.inverseViewProjection.value.multiplyMatrices(
          viewCamera.matrixWorld,
          viewCamera.projectionMatrixInverse,
        );
        viewCamera.getWorldDirection(fogUniforms.rayDirection.value);
        compositeUniforms.depthRange.value = viewCamera.far - viewCamera.near;
        if (scene.background?.isColor)
          compositeUniforms.backgroundColour.value.copy(scene.background);
        gpu.setRenderTarget(sceneTarget);
        renderAreaSurfaces(gpu, scene, viewCamera);
        // Complete the scene colour/depth pass before integrating the volume.
        gpu.setRenderTarget(fogTarget);
        gpu.render(fogScene, camera);
        gpu.setRenderTarget(previous);
        gpu.render(compositeScene, camera);
      } finally {
        gpu.setRenderTarget(previous);
      }
    },
    destroy() {
      skyMotion.clear();
      releaseTargets();
      noise?.dispose();
      fogUniforms.densityField.value?.dispose();
      fogMaterial.dispose();
      compositeMaterial.dispose();
      quadGeometry.dispose();
    },
  };
}
