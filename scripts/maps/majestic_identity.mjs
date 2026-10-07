import { isDeepStrictEqual } from "node:util";

// The server assigns logical identity and owns group membership across versions.
export function confirmedMajesticModel(expected, live) {
  if (!live?.definitionId || !/^MH-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(live.code))
    throw new Error("Fresh MCP identity and group code required");
  if (expected.definitionId && expected.definitionId !== live.definitionId)
    throw new Error("Logical model identity changed");
  const { definitionId: beforeID, code: beforeCode, ...before } = expected;
  const { definitionId: afterID, code: afterCode, ...after } = live;
  if (!isDeepStrictEqual(before, after))
    throw new Error("MCP has not confirmed this exact model and its assets");
  return live;
}
