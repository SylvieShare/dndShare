import {
  Color,
  LinearSRGBColorSpace,
  Mesh,
  MeshBasicMaterial,
  NoBlending,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
} from "three";
import { TILE_ACCENT, OBJECT_ACCENT } from "./mapAccents";
import { outlineState, sameOutlineState } from "./outlineState";

export function createOutlinePasses(gpu) {
  const mask = new WebGLRenderTarget(1, 1, { samples: 4 }),
    result = new WebGLRenderTarget(1, 1, { depthBuffer: false });
  result.texture.colorSpace = LinearSRGBColorSpace;
  const depth = new MeshBasicMaterial({ colorWrite: false }),
    shader = new ShaderMaterial({
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        selectionColour: { value: new Color(TILE_ACCENT) },
        hasSelectionColour: { value: false },
        invalidColour: { value: new Color(0xff4f58) },
        mask: { value: mask.texture },
        texel: { value: new Vector2(1, 1) },
        tileColour: { value: new Color(TILE_ACCENT) },
        objectColour: { value: new Color(OBJECT_ACCENT) },
      },
      vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,
      fragmentShader: `uniform sampler2D mask;uniform vec2 texel;uniform vec3 tileColour;uniform vec3 objectColour;uniform vec3 selectionColour;uniform vec3 invalidColour;uniform bool hasSelectionColour;
varying vec2 vUv;
void main(){
 vec3 center=texture2D(mask,vUv).rgb;vec3 edge=vec3(0.0);float invalidEdge=0.0;
 for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){
  vec2 offset=vec2(float(x),float(y))*texel;
  vec3 inner=texture2D(mask,vUv+offset).rgb;
  vec3 outer=texture2D(mask,vUv+offset*2.0).rgb;
  invalidEdge=max(invalidEdge,min(outer.r,min(outer.g,outer.b)));
  edge.r=max(edge.r,inner.r);edge.g=max(edge.g,outer.g);edge.b=max(edge.b,inner.b);
  edge.b=max(edge.b,outer.b*step(0.75,outer.b));
 }
 edge=max(edge-center,vec3(0.0));
 vec3 colour=edge.b>0.0?objectColour:tileColour;
 if(hasSelectionColour&&(edge.g>0.0||edge.b>0.75))colour=selectionColour;
 if(invalidEdge-min(center.r,min(center.g,center.b))>0.0)colour=invalidColour;
 gl_FragColor=vec4(colour,max(max(edge.r*0.55,edge.g),edge.b));
 #include <colorspace_fragment>
}`,
    });
  const geometry = new PlaneGeometry(2, 2),
    filterScene = new Scene(),
    overlay = new Scene(),
    image = new MeshBasicMaterial({
      map: result.texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    }),
    camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1),
    size = new Vector2(),
    clearColour = new Color();
  filterScene.userData.renderCategory = overlay.userData.renderCategory =
    "overlays";
  filterScene.add(new Mesh(geometry, shader));
  overlay.add(new Mesh(geometry, image));
  let previous = null;
  const invalidate = () => {
    previous = null;
  };
  gpu.domElement?.addEventListener("webglcontextrestored", invalidate);
  return {
    colour(value) {
      shader.uniforms.hasSelectionColour.value = !!value;
      if (value) shader.uniforms.selectionColour.value.set(value);
    },
    invalidate,
    render(
      scene,
      view,
      annotations,
      previews,
      excluded,
      maskScene,
      sources,
      revision,
      prepare,
    ) {
      gpu.getDrawingBufferSize(size);
      const ratio = gpu.getPixelRatio(),
        ignored = new Set([annotations, ...previews, ...excluded]),
        colours = [
          shader.uniforms.hasSelectionColour.value,
          ...shader.uniforms.selectionColour.value.toArray(),
        ],
        state = outlineState(
          scene,
          view,
          sources,
          ignored,
          revision,
          size.x,
          size.y,
          ratio,
          colours,
        ),
        dirty = !sameOutlineState(previous, state),
        oldTarget = gpu.getRenderTarget(),
        autoClear = gpu.autoClear,
        shadows = gpu.shadowMap.enabled,
        background = scene.background,
        override = scene.overrideMaterial,
        hidden = [...ignored].map((node) => [node, node.visible]),
        alpha = gpu.getClearAlpha();
      gpu.getClearColor(clearColour);
      try {
        gpu.autoClear = false;
        gpu.shadowMap.enabled = false;
        if (dirty) {
          prepare();
          if (mask.width !== size.x || mask.height !== size.y) {
            mask.setSize(size.x, size.y);
            result.setSize(size.x, size.y);
          }
          shader.uniforms.texel.value.set(ratio / size.x, ratio / size.y);
          gpu.setRenderTarget(mask);
          gpu.setClearColor(0x000000, 0);
          gpu.clear();
          scene.background = null;
          scene.overrideMaterial = depth;
          for (const [node] of hidden) node.visible = false;
          gpu.render(scene, view);
          gpu.render(maskScene, view);
          gpu.setRenderTarget(result);
          gpu.clear();
          gpu.render(filterScene, camera);
          previous = state;
        }
        gpu.setRenderTarget(oldTarget);
        gpu.render(overlay, camera);
      } finally {
        scene.background = background;
        scene.overrideMaterial = override;
        for (const [node, visible] of hidden) node.visible = visible;
        gpu.shadowMap.enabled = shadows;
        gpu.autoClear = autoClear;
        gpu.setClearColor(clearColour, alpha);
        gpu.setRenderTarget(oldTarget);
      }
    },
    destroy() {
      gpu.domElement?.removeEventListener("webglcontextrestored", invalidate);
      mask.dispose();
      result.dispose();
      depth.dispose();
      shader.dispose();
      image.dispose();
      geometry.dispose();
      previous = null;
    },
  };
}
