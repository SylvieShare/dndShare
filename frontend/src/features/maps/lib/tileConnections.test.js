import { describe, expect, it } from "vitest";
import catalogue from "../../../../../internal/battlemap/catalogue.json";
import {
  connectionVariant,
  modelConnections,
  rotateConnections,
} from "./tileConnections";
const model = (code) => catalogue.find((m) => m.sourceCode === code);
const tile = (code, rotation = 0) => ({ modelId: model(code).id, rotation });

describe("wall connection variants", () => {
  it("derives the prepared models ports from their actual blocker polygons", () => {
    expect(
      ["LC-001", "LC-003", "LC-004", "LC-005", "LC-006", "LC-007"].map((code) =>
        modelConnections(model(code)),
      ),
    ).toEqual([17, 65, 21, 85, 1, 0]);
    expect(modelConnections(model("LC-014"))).toBe(65);
  });
  it("rotates cardinal and diagonal connection points by quarter turns", () => {
    expect(rotateConnections(1, 90)).toBe(4);
    expect(rotateConnections(128, 90)).toBe(2);
    expect(rotateConnections(65, 90)).toBe(5);
  });
  it("picks an ending, angle, tee, cross and floor without inventing a mesh", () => {
    for (const [mask, code] of [
      [1, "LC-006"],
      [5, "LC-003"],
      [21, "LC-004"],
      [85, "LC-005"],
      [0, "LC-007"],
    ]) {
      expect(connectionVariant(tile("LC-007"), mask, catalogue).modelId).toBe(
        model(code).id,
      );
    }
    expect(connectionVariant(tile("LC-007"), 5, catalogue).rotation).toBe(90);
  });
  it("preserves the current model and stalagmite family where available", () => {
    expect(connectionVariant(tile("LC-002"), 17, catalogue).modelId).toBe(
      model("LC-002").id,
    );
    expect(connectionVariant(tile("LC-012"), 1, catalogue).modelId).toBe(
      model("LC-015").id,
    );
  });
  it("returns no candidate for unsupported diagonal combinations", () => {
    expect(connectionVariant(tile("LC-001"), 2, catalogue)).toBeNull();
    expect(connectionVariant(tile("LC-001"), 87, catalogue)).toBeNull();
  });
});
