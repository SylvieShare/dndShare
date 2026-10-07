import { CanvasTexture, NearestFilter, Vector2 } from "three";

export function createMapFog() {
  const canvas = document.createElement("canvas");
  const texture = new CanvasTexture(canvas);
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.generateMipmaps = false;
  const size = new Vector2(1, 1),
    master = { value: 1 };
  return {
    update(d, state, isMaster) {
      const scale = 8;
      canvas.width = Math.ceil(d.width * scale);
      canvas.height = Math.ceil(d.height * scale);
      size.set(d.width, d.height);
      master.value = isMaster ? 1 : 0;
      const c = canvas.getContext("2d"),
        values = { hidden: 0, explored: 90, visible: 255 };
      const colour = (value) => `rgb(${value},${value},${value})`;
      c.fillStyle = colour(
        !state?.fog ? 255 : (values[state.defaultVisibility] ?? 0),
      );
      c.fillRect(0, 0, canvas.width, canvas.height);
      if (state?.fog) {
        const zones = [...d.zones].sort(
          (a, b) =>
            (values[state.zones[a.id]] ?? 0) - (values[state.zones[b.id]] ?? 0),
        );
        for (const z of zones) {
          c.fillStyle = colour(values[state.zones[z.id]] ?? 0);
          for (const cell of z.cells) {
            const x = cell % Math.ceil(d.width),
              y = Math.floor(cell / Math.ceil(d.width));
            c.fillRect(x * scale, y * scale, scale, scale);
          }
          for (const r of z.rects)
            c.fillRect(
              r.x * scale,
              r.y * scale,
              r.width * scale,
              r.height * scale,
            );
        }
      }
      texture.needsUpdate = true;
    },
    material(material) {
      material.onBeforeCompile = (shader) => {
        shader.uniforms.mapVisibility = { value: texture };
        shader.uniforms.mapSize = { value: size };
        shader.uniforms.mapMaster = master;
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            "#include <common>\nvarying vec2 mapPosition;",
          )
          .replace(
            "#include <project_vertex>",
            `#include <project_vertex>
vec4 mapWorld = vec4(transformed,1.0);
#ifdef USE_INSTANCING
mapWorld = instanceMatrix * mapWorld;
#endif
mapWorld = modelMatrix * mapWorld;
mapPosition = mapWorld.xz;`,
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            `#include <common>
uniform sampler2D mapVisibility;
uniform vec2 mapSize;
uniform float mapMaster;
varying vec2 mapPosition;`,
          )
          .replace(
            "#include <opaque_fragment>",
            `float mapSeen=texture2D(mapVisibility,vec2(mapPosition.x/mapSize.x,1.0-mapPosition.y/mapSize.y)).r;
if(mapMaster<0.5 && mapSeen<0.02) discard;
float mapShade=mix(0.26,1.0,mapSeen);
if(mapMaster>0.5 && mapSeen<0.02) mapShade+=step(0.5,fract((mapPosition.x+mapPosition.y)*3.0))*0.06;
outgoingLight*=mapShade;
#include <opaque_fragment>`,
          );
      };
      material.customProgramCacheKey = () => "map-visibility-v2";
      return material;
    },
    destroy() {
      texture.dispose();
    },
  };
}
