import { normalizeContentSourceSettings } from '@/shared/api/contentSourcesApi'
import { emptyScores } from './dndCreateWizardStats'

export const DND_WIZARD_STORAGE_KEY = 'dnd-create-wizard-v1'

const PERSISTED_KEYS = [
  'step', 'version', 'contentSources', 'name', 'race', 'subrace', 'charClass',
  'subclass', 'raceVariant', 'statMethod', 'scores', 'rollPool', 'asiChoice',
  'raceSkillIds', 'raceLangIds', 'featIds', 'featSelections', 'skillIds',
  'spellIds', 'choices', 'background', 'bgLangIds', 'classEquipmentChoices',
  'equipment', 'persona',
]

export function createDndWizardState() {
  return {
    step: 0,
    version: '2014',
    contentSources: normalizeContentSourceSettings(null),
    name: '',
    race: null,
    subrace: null,
    charClass: null,
    subclass: null,
    raceVariant: null,
    statMethod: 'array',
    scores: emptyScores(),
    rollPool: [],
    asiChoice: [],
    raceSkillIds: [],
    raceLangIds: [],
    featIds: [],
    featSelections: {},
    skillIds: [],
    spellIds: [],
    choices: {},
    background: null,
    bgLangIds: [],
    classEquipmentChoices: {},
    equipment: [],
    persona: {
      alignment: '', traits: '', ideals: '', bonds: '', flaws: '', appearance: '',
      backstory: '', allies: '', age: '', height: '', weight: '', eyes: '', hair: '', skin: '',
    },
  }
}

export function serializeDndWizardState(state) {
  return Object.fromEntries(PERSISTED_KEYS.map((key) => [key, state[key]]))
}
