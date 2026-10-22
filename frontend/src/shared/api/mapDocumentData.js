// Match the map API's optional false flags without mutating input snapshots.
// Keep this domain rule out of the generic patch comparison contract.
export function canonicalMapData(data) {
  if (!data.document?.tiles?.some((tile) => tile.mirrored === false))
    return data
  return {
    ...data,
    document: {
      ...data.document,
      tiles: data.document.tiles.map((tile) => {
        if (tile.mirrored !== false) return tile
        const { mirrored, ...rest } = tile
        return rest
      }),
    },
  }
}
