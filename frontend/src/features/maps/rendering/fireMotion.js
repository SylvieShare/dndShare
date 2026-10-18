export const FIRE_FPS = 12;
export const fireClock = (milliseconds) =>
  Math.floor((milliseconds * FIRE_FPS) / 1000) / FIRE_FPS;
export const fireSeed = (id) =>
  [...id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) | 0, 0) % 1000;

// Sample the same waves as the flame shader near its upper tongue. Light travel
// stays proportional to the visual's dimensions rather than its illumination radius.
export function fireMotion(source, milliseconds, stationary = false) {
  const effect = source.effect;
  if (stationary || !effect || !effect.strength)
    return { offset: [0, 0, 0], gain: 1, moving: false };
  const t = fireClock(milliseconds),
    phase = fireSeed(source.id),
    y = 0.75,
    strength = effect.strength,
    weight = y * y * strength,
    first = Math.sin(t * 7.3 + y * 5 + phase),
    second = Math.sin(t * 13.1 - y * 8 + phase);
  return {
    offset: [
      weight * (0.13 * first + 0.05 * second) * effect.size[0],
      weight * 0.12 * Math.sin(t * 9.1 + phase) * effect.size[1],
      weight * 0.1 * Math.sin(t * 8.7 + y * 6 + phase) * effect.size[0],
    ],
    gain: 1 + strength * (0.035 * first + 0.025 * second),
    moving: true,
  };
}
