import {
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  TextureLoader,
} from "three";
import { FLOOR } from "./annotations";
import { disposeObjects } from "./sceneObjects";
export function createMapBackground(scene, fog, onError, render) {
  let root = new Group(),
    key = "",
    dead = false;
  scene.add(root);
  function update(d, options) {
    const next = JSON.stringify([d.kind, d.width, d.height, d.background]);
    if (key === next) return;
    key = next;
    scene.remove(root);
    disposeObjects(root);
    root = new Group();
    scene.add(root);
    if (d.kind === "tiles" || !d.background.url) return;
    const url = d.background.assetId
      ? options.publicCode
        ? `/api/public/sessions/${encodeURIComponent(options.publicCode)}/map-background`
        : `/api/storage/images/${d.background.assetId}`
      : d.background.url;
    new TextureLoader().load(
      url,
      (texture) => {
        if (dead || key !== next) {
          texture.dispose();
          return;
        }
        texture.colorSpace = SRGBColorSpace;
        const mesh = new Mesh(
          new PlaneGeometry(d.width, d.height),
          fog.material(new MeshBasicMaterial({ map: texture })),
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(d.width / 2, FLOOR - 0.02, d.height / 2);
        root.add(mesh);
        render();
      },
      undefined,
      () => onError("Не удалось загрузить фон карты"),
    );
  }
  return {
    update,
    destroy() {
      dead = true;
      scene.remove(root);
      disposeObjects(root);
    },
  };
}
