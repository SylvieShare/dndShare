import { Group } from "three";
import { buildMapProp, disposeObjects } from "./sceneObjects";
import { FLOOR } from "./annotations";
export function createObjectPreview(fog) {
  const root = new Group();
  root.userData.outlineStyle = "selected";
  let target = null,
    key = "",
    position = null;
  function update(object) {
    target = object;
    root.visible = !!object;
    if (!object) {
      disposeObjects(root);
      root.clear();
      key = "";
      position = null;
      return;
    }
    const group = object.group || [object],
      next = JSON.stringify(
        group.map((o) => [o.id, o.kind, o.scale, o.rotation, o.open]),
      );
    if (next !== key) {
      disposeObjects(root);
      root.clear();
      key = next;
      for (const o of group) root.add(buildMapProp(o, o.open, fog));
      root.traverse((n) => {
        if (n.isMesh) {
          n.material.transparent = true;
          n.material.opacity = 0.7;
        }
      });
    }
    position ||= { x: object.x, y: object.y, lift: 0 };
  }
  function advance(delta) {
    if (!target || !position) return false;
    const amount = 1 - Math.exp(-delta / 45),
      lift = target.moving ? 0.22 : 0;
    position.x += (target.x - position.x) * amount;
    position.y += (target.y - position.y) * amount;
    position.lift += (lift - position.lift) * amount;
    (target.group || [target]).forEach((o, i) =>
      root.children[i].position.set(
        o.x + position.x - target.x,
        FLOOR + position.lift,
        o.y + position.y - target.y,
      ),
    );
    root.updateMatrixWorld(true);
    return (
      Math.hypot(
        target.x - position.x,
        target.y - position.y,
        lift - position.lift,
      ) > 0.001
    );
  }
  return { root, update, advance, destroy: () => disposeObjects(root) };
}
