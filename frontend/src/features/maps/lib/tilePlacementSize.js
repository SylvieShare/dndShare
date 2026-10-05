export function tileSize(tile, model) {
  const swapped = tile.rotation % 180 !== 0;
  return {
    width: (swapped ? model?.height : model?.width) || 1,
    height: (swapped ? model?.width : model?.height) || 1,
  };
}
