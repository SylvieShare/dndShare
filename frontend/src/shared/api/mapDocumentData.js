// Match the map API's omitted fields without mutating input snapshots.
// Keep this domain rule out of the generic patch comparison contract.
export function canonicalMapData(data) {
  const document = data.document
  const emptyCameras =
    Array.isArray(document?.cameras) && !document.cameras.length
  const mirrored = document?.tiles?.some((tile) => tile.mirrored === false)
  if (!emptyCameras && !mirrored) return data
  const next = { ...document }
  if (emptyCameras) delete next.cameras
  if (mirrored)
    next.tiles = document.tiles.map((tile) => {
      if (tile.mirrored !== false) return tile
      const { mirrored, ...rest } = tile
      return rest
    })
  return {
    ...data,
    document: next,
  }
}
