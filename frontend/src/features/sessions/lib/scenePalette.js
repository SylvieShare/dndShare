import { PRESET_COLORS, randomPreset } from '@/shared/ui/colorPresets'

export const SCENE_PALETTE = PRESET_COLORS

export function randomSceneColor() {
  return randomPreset()
}
