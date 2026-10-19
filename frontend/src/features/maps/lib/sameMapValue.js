export function sameMapValue(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a).filter((key) => a[key] !== undefined);
  const other = Object.keys(b).filter((key) => b[key] !== undefined);
  return (
    keys.length === other.length &&
    keys.every((key) => sameMapValue(a[key], b[key]))
  );
}
