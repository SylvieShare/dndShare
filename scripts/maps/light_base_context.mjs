import path from "node:path";
export function lightBaseDirectory(code) {
  const collection = {
    MT1: "medieval-town-vol1",
    UD: "ultimate-dungeon",
    LC: "lost-cave",
    MH: "majestic-highlands",
  }[code?.split("-")[0]];
  if (!collection || !/^(MT1|UD|LC|MH)-\d{3}$/.test(code))
    throw Error("One supported model code required");
  return path.resolve(
    import.meta.dirname,
    "../../models/collections",
    collection,
    "light-effects",
    code,
  );
}
