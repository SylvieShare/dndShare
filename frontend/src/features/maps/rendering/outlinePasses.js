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
  Vector4,
  WebGLRenderTarget,
} from "three";
import { TILE_ACCENT, OBJECT_ACCENT } from "./mapAccents";
import { outlineRegion } from "./outlineRegion";
import { renderPass } from "./renderPass";
import {
  dynamicOutlineState,
  outlineState,
  sameOutlineState,
} from "./outlineState";

export function createOutlinePasses(gpu) {
  const result = new WebGLRenderTarget(1, 1, { depthBuffer: false });
  result.texture.colorSpace = LinearSRGBColorSpace;
  const shader = new ShaderMaterial({
    blending: NoBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      selectionColour: { value: new Color(TILE_ACCENT) },
      hasSelectionColour: { value: false },
      invalidColour: { value: new Color(0xff4f58) },
      mask: { value: null },
      maskRegion: { value: new Vector4() },
      maskBounds: { value: new Vector4() },
      texel: { value: new Vector2(1, 1) },
      tileColour: { value: new Color(TILE_ACCENT) },
      objectColour: { value: new Color(OBJECT_ACCENT) },
    },
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,
    fragmentShader: `uniform sampler2D mask;uniform vec4 maskRegion;uniform vec4 maskBounds;uniform vec2 texel;uniform vec3 tileColour;uniform vec3 objectColour;uniform vec3 selectionColour;uniform vec3 invalidColour;uniform bool hasSelectionColour;
varying vec2 vUv;
vec3 readMask(vec2 uv){return texture2D(mask,clamp(maskRegion.xy+uv*maskRegion.zw,maskBounds.xy,maskBounds.zw)).rgb;}
void main(){
 vec3 center=readMask(vUv);vec3 edge=vec3(0.0);float invalidEdge=0.0;
 for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){
  vec2 offset=vec2(float(x),float(y))*texel;
  vec3 inner=readMask(vUv+offset);
  vec3 outer=readMask(vUv+offset*2.0);
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
    size = new Vector2();
  filterScene.userData.renderCategory = overlay.userData.renderCategory =
    "outline";
  filterScene.add(new Mesh(geometry, shader));
  const quad = new Mesh(geometry, image);
  overlay.add(quad);
  let previous = null,
    region = null;
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
      frameDepth,
      animated,
    ) {
      gpu.getDrawingBufferSize(size);
      const ratio = gpu.getPixelRatio(),
        ignored = new Set([annotations, ...previews, ...excluded]),
        colours = [
          shader.uniforms.hasSelectionColour.value,
          ...shader.uniforms.selectionColour.value.toArray(),
        ],
        base = outlineState(
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
        state = base.concat(
          dynamicOutlineState(animated, region, view, size.x, size.y),
        ),
        dirty = !sameOutlineState(previous, state);
      renderPass(gpu, scene, ({ target: oldTarget }) => {
        gpu.autoClear = false;
        gpu.shadowMap.enabled = false;
        if (dirty) {
          prepare();
          maskScene.updateMatrixWorld(true);
          region = outlineRegion(maskScene, view, size.x, size.y, ratio);
          if (!region) {
            previous = base;
            return;
          }
          if (
            result.width !== region.width ||
            result.height !== region.height
          ) {
            result.setSize(region.width, region.height);
          }
          shader.uniforms.texel.value.set(
            ratio / region.width,
            ratio / region.height,
          );
          quad.scale.set(region.width / size.x, region.height / size.y, 1);
          quad.position.set(
            (2 * region.x + region.width) / size.x - 1,
            (2 * region.y + region.height) / size.y - 1,
            0,
          );
          shader.uniforms.mask.value = frameDepth.mask(maskScene, view, region);
          shader.uniforms.maskRegion.value.set(
            region.x / size.x,
            region.y / size.y,
            region.width / size.x,
            region.height / size.y,
          );
          shader.uniforms.maskBounds.value.set(
            (region.x + 0.5) / size.x,
            (region.y + 0.5) / size.y,
            (region.x + region.width - 0.5) / size.x,
            (region.y + region.height - 0.5) / size.y,
          );
          gpu.setRenderTarget(result);
          gpu.setClearColor(0, 0);
          gpu.clear();
          gpu.render(filterScene, camera);
          previous = base.concat(
            dynamicOutlineState(animated, region, view, size.x, size.y),
          );
        }
        if (region) {
          gpu.setRenderTarget(oldTarget);
          gpu.render(overlay, camera);
        }
      });
    },
    destroy() {
      gpu.domElement?.removeEventListener("webglcontextrestored", invalidate);
      result.dispose();
      shader.dispose();
      image.dispose();
      geometry.dispose();
      previous = null;
    },
  };
}
