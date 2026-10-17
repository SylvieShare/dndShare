export const fogVertex = `varying vec2 vUv;
void main() { vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`;
export const volumeFogFragment = `precision highp sampler3D;
varying vec2 vUv;
uniform sampler2D sceneDepth;
uniform sampler3D densityField;
uniform sampler3D noiseField;
uniform sampler2D mapVisibility;
uniform vec2 mapSize;
uniform float mapMaster;
uniform mat4 inverseViewProjection;
uniform vec3 rayDirection;
uniform vec3 boundsMin;
uniform vec3 boundsSize;
uniform vec3 sunDirection;
uniform float clock;
uniform float skyLight;
vec3 unproject(vec2 uv, float depth) {
  vec4 p=inverseViewProjection*vec4(uv*2.0-1.0,depth*2.0-1.0,1.0);
  return p.xyz/p.w;
}
void main() {
  vec3 origin=unproject(vUv,0.0), direction=rayDirection;
  vec3 invDirection=1.0/mix(vec3(0.000001),direction,step(vec3(0.000001),abs(direction)));
  vec3 ta=(boundsMin-origin)*invDirection, tb=(boundsMin+boundsSize-origin)*invDirection;
  vec3 nearBox=min(ta,tb), farBox=max(ta,tb);
  float entry=max(0.0,max(nearBox.x,max(nearBox.y,nearBox.z)));
  float exit=min(farBox.x,min(farBox.y,farBox.z));
  float depth=texture2D(sceneDepth,vUv).x;
  exit=min(exit,dot(unproject(vUv,depth)-origin,direction));
  if(exit<=entry) { gl_FragColor=vec4(0.0); return; }
  float stepLength=(exit-entry)/48.0;
  // Stable per-pixel jitter avoids marching bands without temporal shimmer.
  float jitter=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
  float t=entry+stepLength*(0.2+0.6*jitter), transmittance=1.0;
  vec3 scattering=vec3(0.0), wind=vec3(clock*0.004,clock*0.001,clock*0.002);
  for(int i=0;i<48;i++) {
    vec3 p=origin+direction*t;
    float shape=texture(densityField,(p-boundsMin)/boundsSize).r;
    if(shape>0.005) {
      float seen=texture2D(mapVisibility,vec2(p.x/mapSize.x,1.0-p.z/mapSize.y)).r;
      if(mapMaster>0.5 || seen>0.02) {
        vec3 uvw=p*0.043+wind;
        float coarse=texture(noiseField,uvw).r;
        float detail=texture(noiseField,uvw*3.17+vec3(0.37,0.11,0.68)).r;
        float billow=coarse*0.75+detail*0.25;
        vec3 warp=vec3(coarse-0.5,detail-0.5,coarse+detail-1.0)*0.85;
        shape=texture(densityField,(p+warp-boundsMin)/boundsSize).r;
        float density=smoothstep(0.02,0.6,shape-(1.0-billow)*0.36)*smoothstep(0.12,0.85,billow);
        float ahead=texture(noiseField,uvw+sunDirection*0.017).r;
        float light=clamp(0.6+(ahead-coarse)*2.8,0.15,1.0);
        vec3 colour=mix(vec3(0.075,0.095,0.13),vec3(0.46,0.52,0.6),light);
        colour*=mix(0.3,1.0,seen)*skyLight;
        float opacity=1.0-exp(-density*stepLength*7.0);
        scattering+=transmittance*opacity*colour;
        transmittance*=1.0-opacity;
        if(transmittance<0.015) break;
      }
    }
    t+=stepLength;
  }
  gl_FragColor=vec4(scattering,1.0-transmittance);
}`;
export const fogCompositeFragment = `varying vec2 vUv;
uniform sampler2D sceneColour;
uniform sampler2D sceneDepth;
uniform sampler2D fogColour;
uniform vec2 fogSize;
uniform float depthRange;
uniform vec3 backgroundColour;
void main() {
  vec2 pixel=vUv*fogSize-0.5, base=floor(pixel), fraction=fract(pixel);
  float depth=texture2D(sceneDepth,vUv).r;
  vec4 mist=vec4(0.0); float total=0.0;
  // Depth-aware upsampling keeps nearby walls and models in front of the fog.
  for(int y=0;y<2;y++) for(int x=0;x<2;x++) {
    vec2 offset=vec2(float(x),float(y)), uv=(base+offset+0.5)/fogSize;
    vec2 spatial=mix(1.0-fraction,fraction,offset);
    float delta=abs(texture2D(sceneDepth,uv).r-depth)*depthRange;
    float weight=spatial.x*spatial.y*exp(-delta*18.0);
    mist+=texture2D(fogColour,uv)*weight; total+=weight;
  }
  mist=total>0.0001 ? mist/total : vec4(0.0);
  vec3 background=texture2D(sceneColour,vUv).rgb;
  gl_FragColor=vec4(background*(1.0-mist.a)+mist.rgb,1.0);
  #include <tonemapping_fragment>
  // A solid scene background bypasses tone mapping in the normal renderer.
  if(depth>0.999999 && distance(background,backgroundColour)<0.001) {
    vec3 mapped=background;
    #ifdef TONE_MAPPING
      mapped=toneMapping(background);
    #endif
    gl_FragColor.rgb+=(background-mapped)*(1.0-mist.a);
  }
  #include <colorspace_fragment>
}`;
