import { expect, it } from "vitest";
import { BUILTIN_DECALS, decalCatalogueGroups } from "./mapDecals";

it("shows every built-in group and puts each personal image only in the custom group", () => {
  const personal = [
    {
      id: "personal",
      name: "Мой плакат",
      category: "posters",
      imageUrl: "/personal.webp",
    },
  ];
  const groups = decalCatalogueGroups(personal);
  expect(groups.map((group) => group.name)).toEqual([
    "Следы",
    "Граффити",
    "Плакаты",
    "Свои",
  ]);
  const all = groups.flatMap((group) => group.subsections[0].models);
  expect(all).toHaveLength(BUILTIN_DECALS.length + 1);
  expect(new Set(all.map((item) => item.id)).size).toBe(all.length);
  expect(
    groups[2].subsections[0].models.some((item) => item.id === "personal"),
  ).toBe(false);
  expect(groups[3].subsections[0].models[0]).toMatchObject({
    category: "custom",
    previewUrl: "/personal.webp",
  });
  expect(personal[0].category).toBe("posters");
});
