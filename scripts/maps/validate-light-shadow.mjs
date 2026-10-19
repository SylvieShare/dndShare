import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { lightBaseDirectory } from "./light_base_context.mjs";
const require = createRequire("/private/tmp/dndshare-model-tools/package.json"),
  { NodeIO } = require("@gltf-transform/core"),
  { ALL_EXTENSIONS } = require("@gltf-transform/extensions"),
  { MeshoptDecoder } = require("meshoptimizer"),
  {
    Group,
    Mesh,
    MeshBasicMaterial,
    BufferGeometry,
    Float32BufferAttribute,
    Matrix4,
    Vector3,
    Raycaster,
    DoubleSide,
  } = require("three");
await MeshoptDecoder.ready;
const code = process.argv[2];
const directory = lightBaseDirectory(code),
  r = JSON.parse(
    await fs.readFile(path.join(directory, "report.json"), "utf8"),
  ),
  recipe = !code.startsWith("MT1-")
    ? r.recipe
    : JSON.parse(
        await fs.readFile(
          path.join(import.meta.dirname, "medieval-recipes", code + ".json"),
          "utf8",
        ),
      );
const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder }),
  d = await io.read(path.join(directory, "shadow.glb")),
  root = new Group();
for (const node of d.getRoot().listNodes())
  if (node.getMesh())
    for (const primitive of node.getMesh().listPrimitives()) {
      const accessor = primitive.getAttribute("POSITION"),
        positions = [];
      for (let i = 0; i < accessor.getCount(); i++)
        positions.push(...accessor.getElement(i, []));
      const g = new BufferGeometry().setAttribute(
        "position",
        new Float32BufferAttribute(positions, 3),
      );
      g.setIndex([...primitive.getIndices().getArray()]);
      const mesh = new Mesh(g, new MeshBasicMaterial({ side: DoubleSide }));
      mesh.applyMatrix4(new Matrix4().fromArray(node.getWorldMatrix()));
      root.add(mesh);
    }
root.updateMatrixWorld(true);
for (const light of recipe.defaultLights) {
  const origin = new Vector3(
    light.position[0] - r.model.width / 2,
    light.position[2] + r.model.mountDepth,
    light.position[1] - r.model.height / 2,
  );
  if (recipe.lightShadowChecks) {
    const check = recipe.lightShadowChecks;
    for (const direction of check.clearDirections) {
      const hits = new Raycaster(
        origin,
        new Vector3(...direction).normalize(),
        0.0001,
        check.clearDistance,
      ).intersectObject(root, true);
      assert.equal(
        hits.length,
        0,
        `Light is inside solid geometry: ${light.key} ${direction}`,
      );
    }
    const body = new Raycaster(
      origin,
      new Vector3(...check.blockedDirection).normalize(),
      0.0001,
      check.blockedDistance,
    ).intersectObject(root, true);
    assert.ok(
      body.length,
      `Solid support disappeared below/behind ${light.key}`,
    );
    console.log(
      "LIGHT_SHADOW_CHECK",
      code,
      light.key,
      "source clear; solid support preserved",
    );
    continue;
  }
  const forward = new Raycaster(
      origin,
      new Vector3(1, 0, 0),
      0.0001,
      2,
    ).intersectObject(root, true),
    back = new Raycaster(
      origin,
      new Vector3(-1, 0, 0),
      0.0001,
      2,
    ).intersectObject(root, true);
  assert.equal(
    forward.length,
    0,
    "Light is blocked by its own sculpt in front: " + light.key,
  );
  assert.ok(
    back.length > 0,
    "Solid wall/post disappeared behind light: " + light.key,
  );
  console.log(
    "LIGHT_SHADOW_CHECK",
    code,
    light.key,
    "front clear; rear wall preserved",
  );
}
