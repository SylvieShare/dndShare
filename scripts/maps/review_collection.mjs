import path from "node:path";
export function reviewCollection(collection = "ultimate-dungeon") {
  if (!["ultimate-dungeon", "lost-cave"].includes(collection))
    throw new Error("Unsupported review collection: " + collection);
  const base = path.resolve(import.meta.dirname, "../../models/collections");
  const detailFolder =
    collection === "ultimate-dungeon"
      ? "ultimate-detail"
      : "lost-cave/detailed";
  return {
    collection,
    base,
    detailFolder,
    snapshot: path.join(base, collection, "registry-snapshot.json"),
    detail: path.join(base, detailFolder),
  };
}
export function requestedCollection(args = process.argv) {
  return reviewCollection(
    args.find((a) => a.startsWith("--collection="))?.slice(13),
  );
}
