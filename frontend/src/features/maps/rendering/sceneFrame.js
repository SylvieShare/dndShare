import {
  Camera,
  DepthTexture,
  HalfFloatType,
  LinearSRGBColorSpace,
  Mesh,
  LinearFilter,
  PlaneGeometry,
  RawShaderMaterial,
  UnsignedByteType,
  UnsignedIntType,
  Vector2,
  WebGLRenderTarget,
} from "three";

// One MSAA world buffer also supplies the outline's depth. The displayed colour
// is presented first; its colour attachment can then hold a cropped mask while
// the original per-sample depth remains untouched.
export function createSceneFrame(gpu) {
  const size = new Vector2(),
    camera = new Camera();
  const geometry = new PlaneGeometry(2, 2);
  const material = new RawShaderMaterial({
    uniforms: { image: { value: null } },
    vertexShader:
      "attribute vec3 position;attribute vec2 uv;varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.0);}",
    fragmentShader:
      "precision highp float;varying vec2 vUv;uniform sampler2D image;void main(){gl_FragColor=texture2D(image,vUv);}",
    depthTest: false,
    depthWrite: false,
  });
  const quad = new Mesh(geometry, material);
  quad.userData.renderCategory = "presentation";
  let target, linear;
  return {
    prepare(hdr = false) {
      gpu.getDrawingBufferSize(size);
      if (!target || linear !== hdr) {
        target?.dispose();
        linear = hdr;
        target = new WebGLRenderTarget(size.x, size.y, {
          samples: 4,
          type:
            hdr && gpu.extensions.has("EXT_color_buffer_float")
              ? HalfFloatType
              : UnsignedByteType,
          depthTexture: hdr
            ? new DepthTexture(size.x, size.y, UnsignedIntType)
            : null,
          resolveDepthBuffer: hdr,
          storeMultisampledDepthBuffer: true,
        });
        // Three r186 only applies the canvas' per-material tone mapping and
        // output colour space to display targets (the flag is named for XR).
        // Explicit RGBA8 storage avoids applying sRGB conversion twice.
        target.isXRRenderTarget = !hdr;
        target.texture.colorSpace = hdr
          ? LinearSRGBColorSpace
          : gpu.outputColorSpace;
        if (!hdr) target.texture.internalFormat = "RGBA8";
        target.texture.minFilter = target.texture.magFilter = LinearFilter;
      } else target.setSize(size.x, size.y);
      // Resize/context restoration recreate Three's properties. Reapply this
      // before allocation: implicit render-to-texture may discard MSAA depth.
      gpu.properties.get(target).__useRenderToTexture = false;
      return target;
    },
    present(destination) {
      material.uniforms.image.value = target.texture;
      gpu.setRenderTarget(destination);
      gpu.render(quad, camera);
    },
    mask(scene, view, region) {
      const scissor = target.scissor.clone(),
        scissorTest = target.scissorTest,
        display = target.isXRRenderTarget,
        autoClear = gpu.autoClear;
      try {
        // The same camera/sample locations preserve occlusion and MSAA edges.
        target.isXRRenderTarget = false;
        gpu.autoClear = false;
        target.scissor.set(region.x, region.y, region.width, region.height);
        target.scissorTest = true;
        gpu.setRenderTarget(target);
        gpu.setClearColor(0, 0);
        gpu.clear(true, false, false);
        gpu.render(scene, view);
        return target.texture;
      } finally {
        target.isXRRenderTarget = display;
        gpu.autoClear = autoClear;
        target.scissor.copy(scissor);
        target.scissorTest = scissorTest;
      }
    },
    destroy() {
      target?.dispose();
      material.dispose();
      geometry.dispose();
    },
  };
}
