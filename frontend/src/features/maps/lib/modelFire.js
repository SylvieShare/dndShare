// Prototype profile: the measured flame of Medieval Town's lit torch.
export const hasModelFire = (model) => model?.definitionId === "MT1-016";
export const modelFireFPS = (model) =>
  Math.max(1, Math.min(60, model?.behaviour?.animationFps ?? 12));
