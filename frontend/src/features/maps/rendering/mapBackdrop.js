import {
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  TextureLoader,
} from "three";
import { FLOOR } from "./annotations";
export function createMapBackdrop(scene, invalidate) {
  const mesh = new Mesh(
    new PlaneGeometry(1, 1),
    new MeshBasicMaterial({ color: 0xffffff }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = FLOOR - 0.025;
  mesh.visible = false;
  scene.add(mesh);
  let key = "",
    epoch = 0,
    texture;
  return {
    async update(d) {
      mesh.visible = d.kind === "image";
      if (!mesh.visible) return;
      const image = d.image;
      if (!image?.url) return;
      const width = image.pixelWidth / image.cellPixels,
        height = image.pixelHeight / image.cellPixels;
      mesh.position.set(
        image.offsetX + width / 2,
        FLOOR - 0.025,
        image.offsetY + height / 2,
      );
      mesh.scale.set(width, height, 1);
      if (image.url === key) return;
      key = image.url;
      const generation = ++epoch;
      const loaded = await new TextureLoader().loadAsync(image.url);
      if (generation !== epoch) {
        loaded.dispose();
        return;
      }
      loaded.colorSpace = SRGBColorSpace;
      texture?.dispose();
      texture = loaded;
      mesh.material.map = texture;
      mesh.material.needsUpdate = true;
      invalidate();
    },
    destroy() {
      epoch++;
      texture?.dispose();
      mesh.geometry.dispose();
      mesh.material.dispose();
      scene.remove(mesh);
    },
  };
}
