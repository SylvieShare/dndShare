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
