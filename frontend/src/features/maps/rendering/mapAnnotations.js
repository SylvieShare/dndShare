import { Group } from "three";
import { buildAnnotations, disposeAnnotations } from "./annotations";
export function createMapAnnotations(scene) {
  const root = new Group();
  scene.add(root);
  let key = "";
  return {
    root,
    update(document, options) {
      const next = JSON.stringify([
        document.width,
        document.height,
        document.kind,
        document.grid,
        document.zones,
        options.master,
        options.showZones,
        options.selectedZone,
        options.selection,
      ]);
      if (next === key) return;
      key = next;
      disposeAnnotations(root);
      root.clear();
      root.add(buildAnnotations(document, options));
    },
    destroy() {
      disposeAnnotations(root);
      scene.remove(root);
      root.clear();
    },
  };
}
