export const defaultFireEffect = () => ({
  kind: "fire",
  size: [0.22, 0.35],
  strength: 0.7,
  offset: [0, 0, -0.175],
});

export function scaledLightEffect(effect, scale = 1) {
  return (
    effect && {
      ...effect,
      size: effect.size.map((v) => v * scale),
      offset: effect.offset.map((v) => v * scale),
    }
  );
}

// The editor uses the flame base as the shared height. Stored source/effect
// coordinates stay unchanged, so existing maps retain their exact placement.
export const lightBaseHeight = (light) =>
  (light.position?.[2] ?? light.height) + (light.effect?.offset[2] || 0);
export const lightSourceOffset = (light) => -(light.effect?.offset[2] || 0);
export const sourceHeightAtBase = (light, height) =>
  height + lightSourceOffset(light);
export function withLightSourceOffset(light, offset) {
  return {
    height: lightBaseHeight(light) + offset,
    effect: {
      ...light.effect,
      offset: [...light.effect.offset.slice(0, 2), -offset],
    },
  };
}

export function lightEffectPose(light, document, posed) {
  const owner =
    light.anchor &&
    (light.anchor.kind === "tile" ? document.tiles : document.objects).find(
      (x) => x.id === light.anchor.id,
    );
  const angle = ((owner?.rotation || 0) * Math.PI) / 180;
  const [x, y, height] = light.effect.offset;
  return {
    ...posed,
    size: light.effect.size,
    strength: light.effect.strength,
    x: posed.x + x * Math.cos(angle) - y * Math.sin(angle),
    y: posed.y + x * Math.sin(angle) + y * Math.cos(angle),
    worldHeight: posed.worldHeight + height,
  };
}
