import { markRaw } from 'vue'
import {
  Anvil, Apple, Axe, Backpack, Bandage, Beef, Beer, Bomb, Bone, BookOpen,
  Candy, Coins, Compass, Cross, Crosshair, Crown, Droplet, Drumstick, Feather,
  FlaskConical, FlaskRound, Flame, Footprints, Gem, GlassWater, Hammer, Heart,
  Key, KeyRound, Leaf, Lock, Map, MapPin, Milk, Moon, Mountain, Package, Pill,
  Scroll, Shield, Skull, Snowflake, Sparkles, Sprout, Star, Sun, Sword, Swords,
  Target, Tent, WandSparkles, Wine, Wrench, Zap,
} from '@lucide/vue'

// Curated Lucide icon set for the counter block's icon picker (`shared/ui/IconPicker`).
// `name` is what gets stored in the block value; `kw` are search keywords (ru + en, lowercased).
// Extend the list with one row — no other code changes are needed; the full Lucide set is available.
const RAW = [
  ['Drumstick', Drumstick, 'еда рацион провизия мясо ножка food ration meat'],
  ['Beef', Beef, 'мясо стейк говядина food meat steak'],
  ['Apple', Apple, 'еда фрукт яблоко food fruit apple'],
  ['Candy', Candy, 'сладость конфета candy sweet'],
  ['Droplet', Droplet, 'вода капля бурдюк water drop'],
  ['GlassWater', GlassWater, 'вода стакан питьё water glass drink'],
  ['Milk', Milk, 'молоко бутыль фляга milk bottle'],
  ['Wine', Wine, 'вино алкоголь wine drink'],
  ['Beer', Beer, 'пиво эль кружка beer ale'],
  ['Flame', Flame, 'огонь факел костёр fire torch flame'],
  ['Zap', Zap, 'заряд молния энергия energy bolt charge'],
  ['Target', Target, 'стрелы боеприпасы цель мишень arrow ammo target'],
  ['Crosshair', Crosshair, 'прицел цель aim target crosshair'],
  ['FlaskConical', FlaskConical, 'зелье колба алхимия potion flask alchemy'],
  ['FlaskRound', FlaskRound, 'зелье колба эликсир potion flask'],
  ['Pill', Pill, 'таблетка лекарство pill medicine'],
  ['Bandage', Bandage, 'бинт повязка лечение bandage heal'],
  ['Cross', Cross, 'аптечка лечение крест health cross heal'],
  ['Heart', Heart, 'сердце жизнь heart life'],
  ['Shield', Shield, 'щит защита shield'],
  ['Sword', Sword, 'меч клинок оружие sword blade weapon'],
  ['Swords', Swords, 'мечи оружие бой swords weapon'],
  ['Axe', Axe, 'топор оружие axe weapon'],
  ['Bomb', Bomb, 'бомба взрыв граната bomb explosive'],
  ['Anvil', Anvil, 'наковальня ковка anvil forge'],
  ['Hammer', Hammer, 'молот инструмент hammer tool'],
  ['Wrench', Wrench, 'ключ инструмент wrench tool'],
  ['Tent', Tent, 'лагерь палатка привал camp tent'],
  ['Backpack', Backpack, 'рюкзак сумка снаряжение backpack bag'],
  ['Package', Package, 'припасы коробка груз package supplies'],
  ['Key', Key, 'ключ замок key'],
  ['KeyRound', KeyRound, 'ключ замок key round'],
  ['Lock', Lock, 'замок защита lock'],
  ['Leaf', Leaf, 'трава лист реагент herb leaf'],
  ['Sprout', Sprout, 'росток растение трава plant sprout herb'],
  ['Moon', Moon, 'луна ночь отдых moon night rest'],
  ['Sun', Sun, 'солнце день sun day'],
  ['Star', Star, 'звезда star'],
  ['Sparkles', Sparkles, 'магия искры волшебство magic sparkle'],
  ['WandSparkles', WandSparkles, 'посох жезл магия wand staff magic'],
  ['Feather', Feather, 'перо feather quill'],
  ['Scroll', Scroll, 'свиток записка пергамент scroll note'],
  ['BookOpen', BookOpen, 'книга гримуар заклинания book spellbook'],
  ['Coins', Coins, 'монеты деньги золото coins money gold'],
  ['Gem', Gem, 'самоцвет камень кристалл gem jewel crystal'],
  ['Map', Map, 'карта map'],
  ['MapPin', MapPin, 'карта метка точка map pin'],
  ['Compass', Compass, 'компас навигация compass navigation'],
  ['Footprints', Footprints, 'следы шаги путь steps tracks travel'],
  ['Mountain', Mountain, 'гора путь mountain'],
  ['Snowflake', Snowflake, 'снег холод зима snow cold winter'],
  ['Bone', Bone, 'кость bone'],
  ['Skull', Skull, 'череп смерть skull death'],
  ['Crown', Crown, 'корона власть crown'],
]

export const COUNTER_ICONS = RAW.map(([name, comp, kw]) => ({ name, comp: markRaw(comp), kw }))

export const DEFAULT_ICON = 'Package'

const ICON_MAP = Object.fromEntries(COUNTER_ICONS.map(i => [i.name, i.comp]))
const FALLBACK = markRaw(Package)

// Resolve a stored icon name to its (markRaw'd) Lucide component, falling back to the default.
export function resolveIcon(name) {
  return ICON_MAP[name] || FALLBACK
}
