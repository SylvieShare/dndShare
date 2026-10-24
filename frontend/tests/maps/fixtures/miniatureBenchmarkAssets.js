import fs from "node:fs";
import path from "node:path";

export function miniatureBenchmarkAssets(root, folder) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "scripts/creatures/pilot-production.json")),
  );
  const assets = new Map();
  function urls(id, files) {
    return Object.fromEntries(
      ["render", "lod", "shadow"].map((role) => {
        const url = `/__miniatures/${id}/${role}.glb`;
        assets.set(url, files[role]);
        return [`${role}Url`, url];
      }),
    );
  }
  const missing = manifest.entries.filter(
    (e) => !fs.existsSync(path.join(folder, e.slug, "final/verification.json")),
  );
  if (missing.length) return { missing: ["pilot assets"], assets };
  const models = manifest.entries.map((e) => {
    const recipe = JSON.parse(
      fs.readFileSync(path.join(folder, e.slug, "recipe.json")),
    );
    const stats = JSON.parse(
      fs.readFileSync(path.join(folder, e.slug, "final/model-stats.json")),
    );
    return {
      id: recipe.modelId,
      definitionId: recipe.sourceCode,
      sourceCode: recipe.sourceCode,
      name: recipe.name,
      tileType: "object",
      category: "object",
      width: 1,
      height: 1,
      mountDepth: 0,
      surfaceHeight: 0,
      maxHeight: stats.find((s) => s.role === "render").bounds[1][1],
      referenceDiameter: recipe.referenceDiameter,
      itemIds: [e.itemId],
      nominalSize: e.size,
      ...urls(
        e.slug,
        Object.fromEntries(
          stats.map((s) => [
            s.role,
            path.join(folder, e.slug, "final", s.file),
          ]),
        ),
      ),
      assetBytes: Object.fromEntries(stats.map((s) => [s.role, s.bytes])),
    };
  });
  const bases = [
    [0.5, "dfde5fa7-4bb1-5909-a039-06cd45d0f008"],
    [1, "3c506a01-f906-5627-a53e-e1198a33968a"],
    [2, "ece4f0e5-ae3a-5d3b-a050-5e8a504c33f7"],
  ].map(([size, id]) => {
    const file = path.join(
      root,
      `models/creatures/separated-bases-20261024/${id}.glb`,
    );
    return {
      id,
      definitionId: `BASE-${size}`,
      name: "Подставка",
      tileType: "object",
      category: "creature-base",
      width: 1,
      height: 1,
      maxHeight: 0.06,
      surfaceHeight: 0.06,
      mountDepth: 0,
      baseSize: size,
      referenceDiameter: 0.9 * size,
      ...urls(id, { render: file, lod: file, shadow: file }),
    };
  });
  const catalogue = JSON.parse(
    fs.readFileSync(path.join(root, "internal/battlemap/catalogue.json")),
  );
  const scenery = ["LC-001", "LC-007"].map((code) => {
    const model = catalogue.find((m) => m.sourceCode === code);
    const files = Object.fromEntries(
      ["render", "lod", "shadow"].map((role) => [
        role,
        path.join(
          root,
          `models/prepared/runtime/${code}.${role === "render" ? "render" : "lod"}.glb`,
        ),
      ]),
    );
    return { ...model, definitionId: code, ...urls(code, files) };
  });
  return {
    models,
    bases,
    scenery,
    assets,
    missing: [...assets.values()].filter((f) => !fs.existsSync(f)),
  };
}
