import { lightArea, lightOpacity, lightPose } from "./mapLighting";

export { flagEnabled, componentEnabled } from "./componentLinks";
export const effectPose = (effect, document, catalogue, context) =>
  lightPose(effect, document, catalogue, context, "defaultEffects");
export const effectArea = lightArea;
export const effectOpacity = lightOpacity;
