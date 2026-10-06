import { paintStone } from "./ultimate_surface.mjs";
import { makeRaisedPainter } from "./raised_material.mjs";
import { makeMetalPainter } from "./measured_metal.mjs";
import { paintDoorBar } from "./ultimate_door.mjs";
import { makeBridgePainter } from "./bridge_material.mjs";
import { makeAddedBonePainter } from "./added_bones.mjs";
import { paintPedestal } from "./ud025_material.mjs";
import { makeBedPainter } from "./bed_material.mjs";
import { paintWallBags, paintGroundBags } from "./sacks_material.mjs";
import { makeTablePainter } from "./table_material.mjs";
import { paintBarrel } from "./barrel_material.mjs";
import { paintWoodFloor } from "./wood_floor_material.mjs";
import { makeTorchPainter } from "./torch_material.mjs";
import { paintBrazier } from "./brazier_material.mjs";
import { makeFountainPainter } from "./fountain_material.mjs";
import { makeGroundGlyphPainter } from "./ground_glyph.mjs";
import { makePrisonPainter } from "./prison_material.mjs";
import { makeTorturePainter } from "./torture_material.mjs";
import { makeUtilityPainter } from "./utility_material.mjs";
import { makeWeaponsPainter } from "./weapons_material.mjs";
import { makeWaterPainter } from "./water_material.mjs";
import { makeArchitecturalBonePainter } from "./architectural_bones.mjs";
import { makeAltarPainter } from "./altar_material.mjs";
import { makeDoubleDoorPainter } from "./double_door_material.mjs";
import { makeColumnHardwarePainter } from "./column_hardware.mjs";
import { makeKeyColumnPainter } from "./key_column_material.mjs";
import fs from "node:fs/promises";
import path from "node:path";
export async function individualPainter({ code, spec, model, collectionBase }) {
  const datum = spec.datum ?? 13.4;
  let painter = (rgb, p, n) => paintStone(rgb, p, n, spec),
    parts = ["base", "floor", "wall"];
  if (spec.material === "stone" && model.maxHeight * 35 <= datum + 2.5)
    parts = model.maxHeight * 35 <= datum ? ["base"] : ["base", "floor"];
  if (spec.material === "key-column") {
    painter = makeKeyColumnPainter(spec);
    parts = ["stone", "glyph", ...(spec.chainBand ? ["iron"] : [])];
  } else if (spec.material === "column-hardware") {
    const floor = spec.floorReference
      ? JSON.parse(
          await fs.readFile(
            path.join(collectionBase, spec.floorReference),
            "utf8",
          ),
        )
      : undefined;
    painter = makeColumnHardwarePainter(spec, floor);
    parts = ["stone", "iron", ...(spec.variant === "slave" ? ["wood"] : [])];
  } else if (spec.material === "double-door") {
    const floor = JSON.parse(
      await fs.readFile(path.join(collectionBase, spec.floorReference), "utf8"),
    );
    painter = makeDoubleDoorPainter(spec, floor);
    parts = ["stone", "wood", "frame", "bone", "iron"];
  } else if (spec.material === "altar") {
    let bare;
    if (spec.sheet) {
      const directory = path.join(collectionBase, "added-reference", code);
      bare = {
        spec: JSON.parse(
          await fs.readFile(path.join(directory, "reference.json"), "utf8"),
        ),
        data: await fs.readFile(path.join(directory, "distance.bin")),
      };
      if (bare.spec.bare !== spec.bareReference)
        throw new Error("Unexpected bare altar reference");
    }
    painter = makeAltarPainter(spec, bare);
    parts = ["stone", "bone", "gold", ...(spec.sheet ? ["cloth"] : [])];
  } else if (spec.material === "architectural-bones") {
    painter = makeArchitecturalBonePainter(spec);
    parts = ["stone", "bone"];
  } else if (spec.material === "water") {
    painter = makeWaterPainter(spec);
    parts = ["stone", "water", ...(spec.variant === "bones" ? ["bone"] : [])];
  } else if (spec.material === "weapons") {
    painter = makeWeaponsPainter(spec);
    parts = ["stone", "rope", "beam", "post", "shaft", "iron"];
  } else if (spec.material === "utility") {
    let bare;
    if (spec.bareReference) {
      const directory = path.join(collectionBase, "added-reference", code);
      bare = {
        spec: JSON.parse(
          await fs.readFile(path.join(directory, "reference.json"), "utf8"),
        ),
        data: await fs.readFile(path.join(directory, "distance.bin")),
      };
      if (
        bare.spec.bare !== spec.bareReference ||
        bare.spec.bareOffsetZ !== spec.bareOffsetZ
      )
        throw new Error("Unexpected utility reference");
    }
    painter = makeUtilityPainter(spec, bare);
    parts =
      spec.variant === "pit"
        ? ["stone", "wood"]
        : ["stone", "iron", ...(spec.variant === "poison" ? ["toxic"] : [])];
  } else if (spec.material === "torture") {
    painter = makeTorturePainter(spec);
    if (spec.variant === "trap") parts = ["stone", "iron", "wood"];
    else
      parts = [
        "stone",
        "iron",
        "bone",
        ...(spec.variant === "rack"
          ? ["wood", "roller"]
          : spec.variant === "chair"
            ? ["wood"]
            : []),
      ];
  } else if (spec.material === "prison") {
    painter = makePrisonPainter(spec);
    if (spec.variant === "corner") {
      parts = ["soil", "stone", "iron"];
    } else
      parts = [
        spec.ground === "earth" ? "soil" : "stone",
        ...(spec.variant === "ground" ? [] : ["iron"]),
      ];
  } else if (spec.material === "glyph") {
    const floor = JSON.parse(
      await fs.readFile(
        path.join(collectionBase, "ultimate-slab-floor.json"),
        "utf8",
      ),
    );
    painter = makeGroundGlyphPainter(floor, spec);
    parts = ["base", "floor", "glyph"];
  } else if (spec.material === "bones") {
    const floor = JSON.parse(
      await fs.readFile(
        path.resolve(
          import.meta.dirname,
          "../../models/collections",
          spec.floorReference,
        ),
        "utf8",
      ),
    );
    painter = makeRaisedPainter(floor, spec);
    parts = ["stone", "bone"];
  } else if (spec.material === "added-bones") {
    const directory = path.join(collectionBase, "added-reference", code);
    const reference = {
      spec: JSON.parse(
        await fs.readFile(path.join(directory, "reference.json"), "utf8"),
      ),
      data: await fs.readFile(path.join(directory, "distance.bin")),
    };
    painter = makeAddedBonePainter(reference, spec);
    parts = ["stone", "bone"];
  } else if (spec.material === "fountain") {
    let bare;
    if (spec.bareReference) {
      const directory = path.join(collectionBase, "added-reference", code);
      bare = {
        spec: JSON.parse(
          await fs.readFile(path.join(directory, "reference.json"), "utf8"),
        ),
        data: await fs.readFile(path.join(directory, "distance.bin")),
      };
      if (
        bare.spec.bare !== spec.bareReference ||
        bare.spec.wall !== spec.bareWallReference ||
        bare.spec.bareMaxZ !== spec.bareMaxZ
      )
        throw new Error("Unexpected bare fountain reference: " + code);
    }
    painter = makeFountainPainter(spec, bare);
    parts = {
      empty: ["stone", "bone", "iron"],
      crystal: ["stone", "crystal"],
      toxic: ["stone", "bone", "toxic"],
      treasure: ["stone", "gold", "silver", "gem"],
    }[spec.variant];
  } else if (spec.material === "brazier") {
    painter = paintBrazier;
    parts = ["stone", "iron", "charcoal"];
  } else if (spec.material === "torch") {
    let bare;
    if (spec.bareReference) {
      const directory = path.join(collectionBase, "added-reference", code);
      bare = {
        spec: JSON.parse(
          await fs.readFile(path.join(directory, "reference.json"), "utf8"),
        ),
        data: await fs.readFile(path.join(directory, "distance.bin")),
      };
      if (bare.spec.bare !== spec.bareReference)
        throw new Error("Unexpected bare torch reference: " + code);
    }
    painter = makeTorchPainter(spec, bare);
    parts = [
      "stone",
      "wood",
      "iron",
      ...(spec.lit ? ["flame"] : ["charcoal", "ash"]),
    ];
  } else if (spec.material === "wood-floor") {
    painter = (rgb, p, n) => paintWoodFloor(rgb, p, n, spec);
    parts = ["stone", "wood", "iron"];
  } else if (spec.material === "barrel") {
    painter = paintBarrel;
    parts = ["stone", "wood", "chain", "hoop"];
  } else if (spec.material === "table") {
    let bare;
    if (spec.bareReference) {
      const directory = path.join(collectionBase, "added-reference", code);
      bare = {
        spec: JSON.parse(
          await fs.readFile(path.join(directory, "reference.json"), "utf8"),
        ),
        data: await fs.readFile(path.join(directory, "distance.bin")),
      };
      if (bare.spec.bare !== spec.bareReference)
        throw new Error("Unexpected bare furniture reference: " + code);
    }
    painter = makeTablePainter(spec, bare);
    parts = spec.full
      ? ["stone", "wood", "plate", "ceramic", "iron", "basket", "fruit"]
      : ["stone", "wood"];
  } else if (spec.material === "ground-bags") {
    painter = paintGroundBags;
    parts = ["stone", "ceramic", "leather", "cloth", "rope"];
  } else if (spec.material === "wall-bags") {
    painter = paintWallBags;
    parts = [
      "stone",
      "wood",
      "iron",
      "ceramic",
      "leather",
      "sack-back",
      "sack-front",
      "rope",
    ];
  } else if (spec.material === "bed") {
    painter = makeBedPainter(spec);
    parts = ["stone", "wood", "cloth", "pillow", "straw"];
  } else if (spec.material === "skull-pedestal") {
    painter = paintPedestal;
    parts = ["stone", "bone", "iron"];
  } else if (spec.material === "bridge-bones") {
    painter = makeBridgePainter(code);
    parts = code === "UD-019" ? ["stone", "bone", "iron"] : ["stone", "bone"];
  } else if (spec.material === "door-bar") {
    painter = paintDoorBar;
    parts = ["stone", "wood", "iron"];
  } else if (spec.material.startsWith("iron-")) {
    painter = makeMetalPainter(spec);
    parts = ["stone", "iron"];
  } else if (spec.material !== "stone")
    throw new Error("Unimplemented material");
  return { painter, parts };
}
