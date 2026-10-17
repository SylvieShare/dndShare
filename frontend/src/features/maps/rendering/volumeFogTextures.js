import {
  Data3DTexture,
  LinearFilter,
  RedFormat,
  RepeatWrapping,
  UnsignedByteType,
} from "three";
export function fogDataTexture(data, dimensions) {
  const texture = new Data3DTexture(data, ...dimensions);
  texture.format = RedFormat;
  texture.type = UnsignedByteType;
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}
export function fogNoiseTexture() {
  const size = 32,
    data = new Uint8Array(size ** 3);
  let seed = 0x1234abcd;
  for (let i = 0; i < data.length; i++) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    data[i] = (seed >>> 0) % 256;
  }
  const texture = fogDataTexture(data, [size, size, size]);
  texture.wrapS = texture.wrapT = texture.wrapR = RepeatWrapping;
  return texture;
}
