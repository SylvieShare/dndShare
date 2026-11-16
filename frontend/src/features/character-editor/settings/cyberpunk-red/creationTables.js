// Core pp. 74–77, 86–89. Canonical order is INT REF DEX TECH COOL WILL LUCK MOVE BODY EMP.
const rows = value => Object.freeze(value.split(' ').map(row => Object.freeze([...row].map(Number))))
export const RED_STAT_TABLES = Object.freeze({
  rockerboy: rows('7665687738 3777767758 4577667758 4577687638 3777686547 5675785737 5667787636 5775666648 3556787557 4565887647'),
  solo: rows('6773865565 7863667566 5874776785 5864676576 6675767684 7765766775 7765677666 7875665684 7764666565 6685665665'),
  netrunner: rows('5877748774 5675838755 5686647674 5777758655 5885737556 6667847766 6667657776 5786848574 7677636565 7866647756'),
  tech: rows('6778445576 7667537755 8657547757 7878446567 6676437766 8756337667 8678447676 8878546566 6678335777 8856446566'),
  medtech: rows('7567538557 6777446777 6558538578 8768356657 6757558768 8558556656 8658548577 6577358558 6677546656 8766348767'),
  media: rows('6655875757 8773666568 6775685557 6575675566 6674876758 7554876758 8563766567 6565686678 7754676567 7663767676'),
  lawman: rows('5675785656 6665685755 5777675576 6676685776 6676776556 7655785674 7875687654 5665685764 7755776556 6656875766'),
  exec: rows('8553866557 8664767757 8763867645 8575656557 7765857756 5773676557 6675876746 6773757557 7675757655 7755866747'),
  fixer: rows('8574658558 8555678757 6664568638 7755767758 8663658756 8755677536 8665656758 6674767747 8775557657 6565568647'),
  nomad: rows('6683676664 5765888754 5863876565 5874867775 6663676774 7684676565 6784667575 5783867555 6764866666 5674787774'),
})

export const RED_BASIC_SKILLS = Object.freeze([
  'athletics', 'brawling', 'concentration', 'conversation', 'education', 'evasion',
  'first-aid', 'human-perception', 'language', 'local-expert', 'perception', 'persuasion', 'stealth',
])

const additional = {
  rockerboy: ['composition', 'handgun', 'melee-weapon', 'personal-grooming', 'play-instrument', 'streetwise', 'wardrobe-style'],
  solo: ['autofire', 'handgun', 'interrogation', 'melee-weapon', 'resist-torture-drugs', 'shoulder-arms', 'tactics'],
  netrunner: ['basic-tech', 'conceal-reveal-object', 'cryptography', 'cybertech', 'electronics-security-tech', 'handgun', 'library-search'],
  tech: ['basic-tech', 'cybertech', 'electronics-security-tech', 'land-vehicle-tech', 'shoulder-arms', 'science', 'weaponstech'],
  medtech: ['basic-tech', 'cybertech', 'deduction', 'paramedic', 'resist-torture-drugs', 'science', 'shoulder-arms'],
  media: ['bribery', 'composition', 'deduction', 'handgun', 'library-search', 'lip-reading', 'photography-film'],
  lawman: ['autofire', 'criminology', 'deduction', 'handgun', 'interrogation', 'shoulder-arms', 'tracking'],
  exec: ['accounting', 'bureaucracy', 'business', 'deduction', 'handgun', 'lip-reading', 'personal-grooming'],
  fixer: ['bribery', 'business', 'forgery', 'handgun', 'pick-lock', 'streetwise', 'trading'],
  nomad: ['animal-handling', 'drive-land-vehicle', 'handgun', 'melee-weapon', 'tracking', 'trading', 'wilderness-survival'],
}
const levels = {
  rockerboy: '26222666242626664664', solo: '22222662226226666666',
  netrunner: '22226622222266666666', tech: '22226662222226666666',
  medtech: '22266626222226466466', media: '22262626266626666444',
  lawman: '26262622222226666666', exec: '22266626222626666664',
  fixer: '22262626462426666466', nomad: '26222662224266666666',
}
export const RED_ROLE_SKILLS = Object.freeze(Object.fromEntries(Object.entries(additional).map(
  ([role, extra]) => [role, Object.freeze([...RED_BASIC_SKILLS, ...extra].map((key, i) =>
    Object.freeze({ key, rank: Number(levels[role][i]) })))],
)))
