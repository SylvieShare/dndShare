import { expect, it, vi } from "vitest";
import { BoxGeometry, Matrix4, MeshStandardMaterial, Texture } from "three";
import { buildModelObject } from "./modelObject";
import { disposeObjects } from "./sceneObjects";

it("releases cloned multi-material objects without disposing shared model geometry or textures", () => {
  const geometry = new BoxGeometry(),
    texture = new Texture(),
    materials = [
      new MeshStandardMaterial({ map: texture }),
      new MeshStandardMaterial(),
    ];
  const assets = {
    model: () => ({
      parts: [{ geometry, material: materials, matrix: new Matrix4() }],
    }),
  };
  const root = buildModelObject(
    {
      id: "chest",
      modelId: "model",
      x: 1,
      y: 2,
      elevation: 0.6,
      scale: 1,
      rotation: 0,
    },
    assets,
    { material: (m) => m },
  );
  expect(root.position.y).toBe(0.6);
  const cloned = root.children[0].material;
  expect(cloned[0]).not.toBe(materials[0]);
  const disposeGeometry = vi.spyOn(geometry, "dispose"),
    disposeTexture = vi.spyOn(texture, "dispose"),
    disposeClone = vi.spyOn(cloned[0], "dispose");
  disposeObjects(root);
  expect(disposeClone).toHaveBeenCalledOnce();
  expect(disposeGeometry).not.toHaveBeenCalled();
  expect(disposeTexture).not.toHaveBeenCalled();
  geometry.dispose();
  texture.dispose();
  materials.forEach((m) => m.dispose());
});
