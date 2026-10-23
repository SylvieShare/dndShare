import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
const recipes = await fetch("gallery.json").then((r) => r.json());
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color("#171d21");
const camera = new THREE.PerspectiveCamera(
  35,
  innerWidth / innerHeight,
  0.01,
  100,
);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xd6e9ff, 0x7b664e, 2.5));
const key = new THREE.DirectionalLight(0xffffff, 1.8);
key.position.set(-2, 4, 3);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = key.shadow.camera.bottom = -2;
key.shadow.camera.right = key.shadow.camera.top = 2;
key.shadow.normalBias = 0.015;
scene.add(key);
const fill = new THREE.DirectionalLight(0xffd7a7, 0.8);
fill.position.set(2, 1, -3);
scene.add(fill);
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: 0x252b2d, roughness: 1 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.005;
floor.receiveShadow = true;
scene.add(floor);
const grid = new THREE.GridHelper(10, 10, 0x58616a, 0x32393f);
grid.position.y = -0.003;
scene.add(grid);
const holder = new THREE.Group();
scene.add(holder);
const loader = new GLTFLoader(),
  cache = new Map();
const clayMaterial = new THREE.MeshStandardMaterial({
  color: 0xc2b3a0,
  roughness: 0.85,
});
let active = recipes[0],
  tier = "render",
  serial = 0,
  clay = false,
  rotate = false,
  height = 1,
  angle = 0,
  viewMode = "close",
  fit = 1;
function position(mode = viewMode) {
  viewMode = mode;
  const scale = Math.max(1, 1 / camera.aspect),
    centre = mode === "close" ? height * 0.45 : 0.15;
  controls.target.set(0, centre, 0);
  const offset =
    mode === "field"
      ? new THREE.Vector3(-2.2, 4.6, 2)
      : mode === "top"
        ? new THREE.Vector3(0, 2.8, 0.025)
        : new THREE.Vector3(-1.8, 0.92, 0.9).multiplyScalar(fit);
  camera.position.copy(controls.target).add(offset.multiplyScalar(scale));
  controls.update();
}
function materials() {
  for (const model of cache.values())
    model.traverse((node) => {
      if (node.isMesh)
        node.material = clay ? clayMaterial : node.userData.paint;
    });
}
function dispose(model) {
  const geos = new Set(),
    mats = new Set(),
    textures = new Set();
  model.traverse((n) => {
    if (!n.isMesh) return;
    geos.add(n.geometry);
    for (const m of [n.userData.paint || n.material].flat().filter(Boolean)) {
      mats.add(m);
      for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
    }
  });
  geos.forEach((v) => v.dispose());
  mats.forEach((v) => v.dispose());
  textures.forEach((v) => {
    v.source?.data?.close?.();
    v.dispose();
  });
  holder.remove(model);
}
async function load(item = active, quality = tier) {
  active = item;
  tier = quality;
  const run = ++serial;
  const id = `${item.slug}:${quality}`;
  document.querySelector("#detail").textContent = "Загрузка модели…";
  const file = quality === "render" ? "model.glb" : `model-${quality}.glb`;
  try {
    if (!cache.has(id)) {
      const gltf = await loader.loadAsync(`${item.slug}/${file}`);
      if (run !== serial) {
        dispose(gltf.scene);
        return;
      }
      gltf.scene.traverse((n) => {
        if (n.isMesh) {
          n.castShadow = n.receiveShadow = true;
          n.userData.paint = n.material;
        }
      });
      holder.add(gltf.scene);
      cache.set(id, gltf.scene);
    }
    if (run !== serial) return;
    for (const [k, m] of cache) m.visible = k === id;
    const box = new THREE.Box3().setFromObject(cache.get(id));
    height = box.max.y;
    fit = Math.max(
      1,
      height / 1.02,
      (box.getBoundingSphere(new THREE.Sphere()).radius * 2) / 1.25,
    );
    let triangles = 0;
    cache.get(id).traverse((n) => {
      if (n.isMesh)
        triangles +=
          (n.geometry.index?.count || n.geometry.attributes.position.count) / 3;
    });
    document.querySelector("#name").textContent = item.name;
    document.querySelector("#detail").textContent =
      `ID ${item.itemIds.join(", ")} · ${Math.round(triangles).toLocaleString("ru-RU")} треугольников · подставка 0,9 клетки`;
    document.querySelector("#download").href = `${item.slug}/${file}`;
    for (const q of ["render", "lod", "source"])
      document.getElementById(q).setAttribute("aria-pressed", q === tier);
    for (const b of document.querySelectorAll(".model"))
      b.setAttribute("aria-pressed", b.dataset.slug === item.slug);
    materials();
    position();
    window.miniatureVariant = id;
    window.miniatureReady = true;
    for (const [k, m] of cache)
      if (cache.size > 2 && k !== id) {
        cache.delete(k);
        dispose(m);
      }
  } catch (error) {
    document.querySelector("#detail").textContent =
      `Не удалось загрузить: ${error.message}`;
    console.error(error);
  }
}
for (const item of recipes) {
  const button = document.createElement("button");
  button.className = "model";
  button.dataset.slug = item.slug;
  button.setAttribute("aria-pressed", "false");
  const img = document.createElement("img");
  img.src = `${item.slug}/preview.png`;
  img.alt = "";
  const text = document.createElement("span");
  text.textContent = item.name;
  const small = document.createElement("small");
  small.textContent = `ID ${item.itemIds.join(", ")}`;
  text.append(small);
  button.append(img, text);
  button.onclick = () => load(item, "render");
  document.querySelector("#models").append(button);
}
for (const q of ["render", "lod", "source"])
  document.getElementById(q).onclick = () => load(active, q);
for (const mode of ["close", "field", "top"])
  document.getElementById(mode).onclick = () => position(mode);
document.getElementById("clay").onclick = (e) => {
  clay = !clay;
  e.target.setAttribute("aria-pressed", clay);
  materials();
};
document.getElementById("rotate").onclick = (e) => {
  rotate = !rotate;
  e.target.setAttribute("aria-pressed", rotate);
};
window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  position();
});
renderer.setAnimationLoop(() => {
  if (rotate) angle += 0.006;
  holder.rotation.y = angle;
  controls.update();
  renderer.render(scene, camera);
});
await load();
