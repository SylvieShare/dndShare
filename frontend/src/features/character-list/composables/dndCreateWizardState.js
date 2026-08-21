import { normalizeContentSourceSettings } from '@/shared/api/contentSourcesApi'
import { emptyScores } from './dndCreateWizardStats'

export const DND_WIZARD_STORAGE_KEY = 'dnd-create-wizard-v2'
export const DND_WIZARD_FLOW_VERSION = 3

const PERSISTED_KEYS = [
  'flowVersion', 'step', 'version', 'contentSources', 'name', 'race', 'subrace', 'charClass',
  'subclass', 'raceVariant', 'statMethod', 'scores', 'rollPool', 'rollSeries', 'asiChoice',
  'raceSkillIds', 'raceLangIds', 'featIds', 'featSelections', 'skillIds',
  'spellIds', 'choices', 'background', 'bgLangIds', 'classEquipmentChoices',
  'backgroundItemChoices',
  'buyStartingEquipment', 'startingWealthRoll', 'startingShopCart', 'equipment', 'persona',
]

export function createDndWizardState() {
  return {
    flowVersion: DND_WIZARD_FLOW_VERSION,
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
    rollSeries: [],
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
    backgroundItemChoices: {},
    classEquipmentChoices: {},
    buyStartingEquipment: false,
    startingWealthRoll: null,
    startingShopCart: [],
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

export function normalizeDndWizardDraft(saved) {
  const draft = { ...saved }
  const savedFlowVersion = Number(draft.flowVersion) || 2
  if (savedFlowVersion < DND_WIZARD_FLOW_VERSION && !draft.buyStartingEquipment && Number(draft.step) > 5) {
    draft.step = Number(draft.step) - 1
  }
  draft.flowVersion = DND_WIZARD_FLOW_VERSION
  return draft
}
