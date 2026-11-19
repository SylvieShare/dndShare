import { Cpu, Moon, Swords } from '@lucide/vue'
import DndCreateCharacterWorkspace from './pages/DndCreateCharacterWorkspace.vue'
import RedCreateCharacterWorkspace from './pages/RedCreateCharacterWorkspace.vue'

export const creationSystems = [
  { system: 'dnd5e', source: 'DND5e', label: 'D&D 5e', icon: Swords, compact: true, workspace: DndCreateCharacterWorkspace },
  { system: 'cyberpunk-red', source: 'Cyberpunk', label: 'Cyberpunk RED', icon: Cpu, workspace: RedCreateCharacterWorkspace },
  { system: 'vtm-v20', label: 'Vampire V20', icon: Moon },
]

export function creationWorkspace(system, source) {
  const profile = creationSystems.find(entry => entry.workspace && entry.system === system)
    || creationSystems.find(entry => entry.workspace && entry.source === source)
  return profile?.workspace || DndCreateCharacterWorkspace
}
