import { createRequire } from "node:module";
const sharp = createRequire("/private/tmp/dndshare-model-tools/package.json")(
  "sharp",
);
export async function transparentPreview(file) {
  const metadata = await sharp(file).metadata();
  if (
    !metadata.hasAlpha ||
    !metadata.width ||
    !metadata.height ||
    metadata.width > 2048 ||
    metadata.height > 2048
  )
    throw Error("Preview requires alpha and dimensions up to 2048");
  const { data, info } = await sharp(file)
    .toColourspace("srgb")
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const corners = [
    0,
    info.width - 1,
    (info.height - 1) * info.width,
    info.width * info.height - 1,
  ];
  if (corners.some((i) => data[i * 4 + 3] !== 0))
    throw Error("Preview backdrop must be transparent");
  let transparent = 0,
    visible = 0,
    opaque = 0;
  const bounds = [info.width, info.height, 0, 0];
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (!a) transparent++;
    else {
      visible++;
      if (a === 255) opaque++;
      const x = (i / 4) % info.width,
        y = Math.floor(i / 4 / info.width);
      bounds[0] = Math.min(bounds[0], x);
      bounds[1] = Math.min(bounds[1], y);
      bounds[2] = Math.max(bounds[2], x);
      bounds[3] = Math.max(bounds[3], y);
    }
  }
  if (!visible) throw Error("Preview is empty");
  if (
    bounds[0] === 0 ||
    bounds[1] === 0 ||
    bounds[2] === info.width - 1 ||
    bounds[3] === info.height - 1
  )
    throw Error("Model touches the preview edge; increase the camera margin");
  const bytes = await sharp(file)
    .webp({ quality: 88, alphaQuality: 100 })
    .toBuffer();
  const encoded = await sharp(bytes)
    .toColourspace("srgb")
    .ensureAlpha()
    .raw()
    .toBuffer();
  for (let i = 3; i < data.length; i += 4)
    if (data[i] !== encoded[i]) throw Error("WebP changed the alpha channel");
  return {
    bytes,
    width: info.width,
    height: info.height,
    transparentPixels: transparent,
    opaquePixels: opaque,
    bounds,
  };
}
