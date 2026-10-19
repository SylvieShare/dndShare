export const MODEL_CACHE_BYTES = 192 * 1024 * 1024;
export const MODEL_CACHE_FILES = 128;

export function pruneModelResidency(owned, pinned, remove, limits = {}) {
  const maxBytes = limits.bytes ?? MODEL_CACHE_BYTES,
    maxFiles = limits.files ?? MODEL_CACHE_FILES;
  const entries = [...owned].filter(([, entry]) => entry.value);
  const size = (entry) =>
    (entry.value.usage?.geometryBytes || 0) +
    (entry.value.usage?.textureBytes || 0);
  let bytes = entries.reduce((total, [, entry]) => total + size(entry), 0),
    files = entries.length;
  const inactive = entries
    .filter(([url]) => !pinned.has(url))
    .sort((a, b) => a[1].used - b[1].used);
  for (const [url, entry] of inactive) {
    if (bytes <= maxBytes && files <= maxFiles) break;
    bytes -= size(entry);
    files--;
    remove(url);
  }
}
