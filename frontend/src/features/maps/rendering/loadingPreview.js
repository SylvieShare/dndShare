import { Group, Mesh, PlaneGeometry, ShaderMaterial, DoubleSide } from "three";
import { tilePose } from "./tileTransform";
import { tileSize } from "../lib/tilePlacement";
export function createLoadingPreview(assets, onChange = () => {}) {
  const root = new Group(),
    geometry = new PlaneGeometry(1, 1);
  const material = new ShaderMaterial({
    side: DoubleSide,
    transparent: true,
    depthWrite: false,
    uniforms: { time: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform float time;
      void main(){
        vec2 p=vUv-0.5; float radius=length(p);
        float checker=mod(floor(vUv.x*8.0)+floor(vUv.y*8.0),2.0);
        vec3 colour=mix(vec3(0.22,0.075,0.4),vec3(0.36,0.16,0.62),checker);
        float ring=1.0-smoothstep(0.0,0.02,abs(radius-0.2));
        float angle=mod(atan(p.y,p.x)-time*3.0+6.283185,6.283185)/6.283185;
        colour=mix(colour,vec3(0.9,0.77,1.0),ring*(0.15+0.85*angle));
        float border=step(0.46,max(abs(p.x),abs(p.y)));
        gl_FragColor=vec4(mix(colour,vec3(0.67,0.43,0.96),border),0.95);
        #include <colorspace_fragment>
      }`,
  });
  let count = 0;
  function update(options, catalogue = []) {
    root.clear();
    const metadata = new Map(catalogue.map((m) => [m.id, m]));
    const tiles =
      options.previewTile?.group ||
      (options.previewTile ? [options.previewTile] : []);
    const objects =
      options.previewObject?.group ||
      (options.previewObject ? [options.previewObject] : []);
    for (const [items, type] of [
      [tiles, "tile"],
      [objects, "object"],
    ])
      for (const item of items) {
        if (assets.model(item.modelId, "render")) continue;
        const model =
          metadata.get(item.modelId) || assets.metadata(item.modelId);
        if (!model) continue;
        const mesh = new Mesh(geometry, material),
          size =
            type === "tile"
              ? tileSize(item, model)
              : { width: 0.76, height: 0.76 };
        const pose = type === "tile" ? tilePose(item, model) : item;
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(pose.x, (pose.elevation || 0) + 0.24, pose.y);
        mesh.scale.set(size.width, size.height, 1);
        root.add(mesh);
      }
    root.visible = !!root.children.length;
    if (count !== root.children.length) {
      count = root.children.length;
      onChange(count);
    }
    root.updateMatrixWorld(true);
  }
  return {
    root,
    update,
    advance(delta) {
      material.uniforms.time.value += delta / 1000;
      return root.visible;
    },
    destroy() {
      root.clear();
      geometry.dispose();
      material.dispose();
    },
  };
}
