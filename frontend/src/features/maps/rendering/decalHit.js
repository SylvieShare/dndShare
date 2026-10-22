const masks = new WeakMap();

// Match selection to visible ink rather than the transparent projector box.
// A small CPU mask is enough for picking; the full image stays on the GPU.
export function visibleDecalPixel(hit) {
  const texture = hit.object.material.map,
    image = texture?.image;
  if (!image || !hit.uv) return false;
  let mask = masks.get(texture);
  if (!mask) {
    const canvas = document.createElement("canvas");
    const ratio = Math.min(1, 256 / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * ratio));
    canvas.height = Math.max(1, Math.round(image.height * ratio));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    mask = {
      width: canvas.width,
      height: canvas.height,
      pixels: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
    };
    masks.set(texture, mask);
    canvas.width = canvas.height = 0;
  }
  const x = Math.max(
    0,
    Math.min(mask.width - 1, Math.floor(hit.uv.x * mask.width)),
  );
  const v = texture.flipY ? 1 - hit.uv.y : hit.uv.y;
  const y = Math.max(0, Math.min(mask.height - 1, Math.floor(v * mask.height)));
  return mask.pixels[(y * mask.width + x) * 4 + 3] > 16;
}
