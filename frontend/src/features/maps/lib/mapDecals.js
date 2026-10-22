const uid = () => crypto.randomUUID();

export const DECAL_CATEGORIES = [
  { id: "traces", name: "Следы" },
  { id: "graffiti", name: "Граффити" },
  { id: "posters", name: "Плакаты" },
  { id: "custom", name: "Свои" },
];
export const BUILTIN_DECALS = [
  ["blood-splash", "Брызги крови", "traces"],
  ["blood-pool", "Лужа крови", "traces"],
  ["mud", "Грязь", "traces"],
  ["rune", "Руна", "graffiti"],
  ["arrow", "Стрелка", "graffiti"],
  ["wanted", "Разыскивается", "posters"],
].map(([id, name, category]) => ({
  id,
  name,
  category,
  imageUrl: `/images/maps/decals/${id}.svg`,
}));

export function decalCatalogueGroups(images) {
  return DECAL_CATEGORIES.map((category) => ({
    key: category.id,
    code: category.id,
    name: category.name,
    subsections: [
      {
        key: category.id,
        models: (category.id === "custom"
          ? images.map((image) => ({ ...image, category: "custom" }))
          : BUILTIN_DECALS.filter((image) => image.category === category.id)
        ).map((image) => ({ ...image, previewUrl: image.imageUrl })),
      },
    ],
  }));
}

export function createDecal(image, surface) {
  return {
    id: uid(),
    name: image.name,
    category: image.category,
    imageUrl: image.imageUrl,
    ...surface,
    width: 1,
    height: image.pixelWidth
      ? Math.max(0.02, Math.min(16, image.pixelHeight / image.pixelWidth))
      : 1,
    depth: 0.15,
    rotation: 0,
    opacity: 1,
    color: "#ffffff",
  };
}
export function pruneDecals(document) {
  if (!document.decals) return;
  const tiles = new Set(document.tiles.map((t) => t.id));
  const objects = new Set(document.objects.map((o) => o.id));
  document.decals = document.decals.filter((d) =>
    (d.anchor.kind === "tile" ? tiles : objects).has(d.anchor.id),
  );
  if (!document.decals.length) delete document.decals;
}
export function copiedDecals(decals, owners) {
  return (decals || [])
    .filter((d) => owners.has(`${d.anchor.kind}:${d.anchor.id}`))
    .map((d) => ({
      ...JSON.parse(JSON.stringify(d)),
      id: uid(),
      anchor: {
        ...d.anchor,
        id: owners.get(`${d.anchor.kind}:${d.anchor.id}`),
      },
    }));
}
