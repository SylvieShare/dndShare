import { describe, expect, it } from "vitest";
import { newMap, paint } from "./mapModel";
import { enclosedEmptyCells } from "./enclosedTiles";
function room() {
  const d = newMap().document;
  d.width = d.height = 7;
  const cells = [];
  for (let x = 1; x <= 5; x++) cells.push({ x, y: 1 }, { x, y: 5 });
  for (let y = 2; y < 5; y++) cells.push({ x: 1, y }, { x: 5, y });
  paint(d, cells, "wall");
  return d;
}
describe("enclosed tile areas", () => {
  it("fills only the empty region behind a closed tile boundary", () => {
    const d = room();
    const cells = enclosedEmptyCells(d, { x: 3.5, y: 3.5 }, []);
    expect(cells).toHaveLength(9);
    expect(cells).toContainEqual({ x: 2, y: 2 });
    expect(enclosedEmptyCells(d, { x: 0.5, y: 0.5 }, [])).toBeNull();
    expect(enclosedEmptyCells(d, { x: 1.5, y: 1.5 }, [])).toBeNull();
  });
  it("rejects the whole preview when there is a gap to the outside", () => {
    const d = room();
    d.tiles = d.tiles.filter((t) => !(t.x === 3 && t.y === 1));
    expect(enclosedEmptyCells(d, { x: 3.5, y: 3.5 }, [])).toBeNull();
  });
});
