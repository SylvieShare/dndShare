import fs from "node:fs";
import assert from "node:assert/strict";

const defaults = JSON.parse(
  fs.readFileSync(new URL("./texture-policy.json", import.meta.url)),
);
export function texturePolicy(recipe = {}) {
  const override = recipe.texturePolicy || {};
  assert.ok(
    Object.keys(override).every((k) => ["render", "lod", "reason"].includes(k)),
    "Unknown texture policy field",
  );
  const policy = structuredClone(defaults);
  for (const role of ["render", "lod"]) {
    const values = override[role] || {};
    assert.ok(
      Object.keys(values).every((k) =>
        ["basecolor", "normal", "orm", "maxMiB"].includes(k),
      ),
      "Unknown texture budget field",
    );
    for (const [key, value] of Object.entries(values)) {
      assert.ok(
        Number.isFinite(value) && value > 0,
        "Positive texture budget required",
      );
      if (key !== "maxMiB")
        assert.ok(
          Number.isInteger(value) &&
            value <= 4096 &&
            (value & (value - 1)) === 0,
          "Power-of-two texture dimensions up to 4096 required",
        );
      if (value > defaults[role][key])
        assert.ok(
          override.reason?.trim(),
          "Larger texture budgets require a reviewed reason",
        );
      policy[role][key] = value;
    }
  }
  if (override.reason) policy.reason = override.reason;
  return policy;
}

export function rgbaMipBytes(width, height) {
  assert.ok(
    Number.isInteger(width) &&
      Number.isInteger(height) &&
      width > 0 &&
      height > 0,
    "Valid texture dimensions required",
  );
  let total = 0;
  for (;;) {
    total += width * height * 4;
    if (width === 1 && height === 1) return total;
    width = Math.max(1, Math.floor(width / 2));
    height = Math.max(1, Math.floor(height / 2));
  }
}

export async function textureMeasurements(doc, readDimensions) {
  const materials = doc.getRoot().listMaterials();
  const colours = new Set(
    materials.map((m) => m.getBaseColorTexture()).filter(Boolean),
  );
  const normals = new Set(
    materials.map((m) => m.getNormalTexture()).filter(Boolean),
  );
  return Promise.all(
    doc
      .getRoot()
      .listTextures()
      .map(async (texture) => {
        const data = texture.getImage(),
          { width, height } = await readDimensions(data);
        return {
          role: colours.has(texture)
            ? "basecolor"
            : normals.has(texture)
              ? "normal"
              : "orm",
          bytes: data.length,
          width,
          height,
          rgbaMipBytes: rgbaMipBytes(width, height),
        };
      }),
  );
}

export function checkTextureBudget(role, textures, policy) {
  const bytes = textures.reduce((n, t) => n + t.rgbaMipBytes, 0);
  for (const texture of textures) {
    assert.ok(
      texture.width <= policy[role][texture.role] &&
        texture.height <= policy[role][texture.role],
      `${role}: ${texture.role} texture exceeds size limit`,
    );
  }
  if (policy[role].maxMiB)
    assert.ok(
      bytes <= policy[role].maxMiB * 1024 ** 2,
      `${role}: decoded texture budget exceeded (${(bytes / 1024 ** 2).toFixed(2)} MiB)`,
    );
  return bytes;
}
