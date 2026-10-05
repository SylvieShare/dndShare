import { describe, expect, it } from "vitest";
import { latestModelVersions } from "./modelVersions";

describe("tile model versions", () => {
  it("offers the newest paint while retaining both differently named UD-055 originals", () => {
    const old = {
      id: "old",
      collection: "ultimate-dungeon",
      sourceCode: "UD-055",
      sourceName: "Prison Cell Angle",
      version: 1,
    };
    const wall = {
      ...old,
      id: "wall",
      sourceName: "Prison Cell Wall",
      version: 2,
    };
    const painted = { ...old, id: "painted", version: 3 };
    const catalogue = [old, wall, painted];
    expect(latestModelVersions(catalogue)).toEqual([painted, wall]);
    expect(catalogue.map((m) => m.id)).toEqual(["old", "wall", "painted"]);
    expect(latestModelVersions([painted, wall, old])).toEqual([painted, wall]);
  });
});
