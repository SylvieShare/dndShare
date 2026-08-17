package store

import (
	"net/url"
	"regexp"
	"sort"
	"strings"
	"unicode"
)

type legacyRichItemRef struct {
	ID     int64
	TypeID int64
	Name   string
	NameEn string
}

type legacyRichSuggestRef struct {
	ID     int64
	TypeID int64
	Value  string
	Code   string
}

type legacyRichResolver struct {
	items    map[int64]map[string][]legacyRichItemRef
	suggests map[int64]map[string]legacyRichSuggestRef
}

type legacySuggestTarget struct {
	TypeID int64
	Value  string
}

var legacyEnglishLabelRE = regexp.MustCompile(`\[([^\[\]]+)]`)

var legacyScreenSuggests = map[string]legacySuggestTarget{
	// Conditions.
	"unconscious":     {9, "Без сознания"},
	"incapacitated":   {9, "Выход из строя"},
	"deafened":        {9, "Глухота"},
	"grapple":         {9, "Захват"},
	"grappled":        {9, "Захват"},
	"frightened":      {9, "Испуг"},
	"invisible":       {9, "Невидимость"},
	"charmed":         {9, "Обворожение"},
	"restrained":      {9, "Обездвиженность"},
	"petrified":       {9, "Окменение"},
	"poisoned":        {9, "Отравление"},
	"paralyzed":       {9, "Паралич"},
	"prone":           {9, "Расплатстанность"},
	"condition_prone": {9, "Расплатстанность"},
	"condition_pron":  {9, "Расплатстанность"},
	"blinded":         {9, "Слепота"},
	"stunned":         {9, "Шок"},

	// Skills.
	"acrobatics":      {15, "Акробатика"},
	"athletics":       {15, "Атлетика"},
	"animal_handling": {15, "Дрессировка"},
	"intimidation":    {15, "Запугивание"},
	"performance":     {15, "Исполнение"},
	"history":         {15, "История"},
	"sleight_of_hand": {15, "Ловкость рук"},
	"arcana":          {15, "Магия"},
	"medicine":        {15, "Медицина"},
	"deception":       {15, "Обман"},
	"nature":          {15, "Природа"},
	"insight":         {15, "Проницательность"},
	"investigation":   {15, "Расследование"},
	"religion":        {15, "Религия"},
	"stealth":         {15, "Скрытность"},
	"persuasion":      {15, "Убеждение"},
	"perception":      {15, "Внимание"},
	"survival":        {15, "Выживание"},

	// Weapon properties.
	"ammunition": {14, "Боеприпас"},
	"two_handed": {14, "Двуручное"},
	"ranged":     {14, "Дистанция"},
	"range":      {14, "Дистанция"},
	"reach":      {14, "Досягаемость"},
	"light":      {14, "Лёгкое"},
	"thrown":     {14, "Метательное"},
	"throwing":   {14, "Метательное"},
	"special":    {14, "Особое"},
	"loading":    {14, "Перезарядка"},
	"heavy":      {14, "Тяжёлое"},
	"versatile":  {14, "Универсальное"},
	"finesse":    {14, "Фехтовальное"},

	// Damage types.
	"bludgeoning": {12, "Дробящий"},
	"thunder":     {12, "Звуком"},
	"radiant":     {12, "Излучением"},
	"acid":        {12, "Кислотой"},
	"piercing":    {12, "Колющий"},
	"lightning":   {12, "Молнией"},
	"necrotic":    {12, "Некротической энергией"},
	"fire":        {12, "Огнем"},
	"psychic":     {12, "Психической энергией"},
	"slashing":    {12, "Рубящий"},
	"force":       {12, "Силовым полем"},
	"cold":        {12, "Холодом"},
	"poison":      {12, "Ядом"},

	// Other existing descriptive catalogues.
	"celestial":    {19, "небожитель"},
	"fiend":        {19, "исчадие"},
	"undead":       {19, "нежить"},
	"lycanthropes": {22, "Ликантропы"},
	"deep_speech":  {6, "Глубинная речь"},
}

func newLegacyRichResolver(items []legacyRichItemRef, suggests []legacyRichSuggestRef) *legacyRichResolver {
	resolver := &legacyRichResolver{
		items:    map[int64]map[string][]legacyRichItemRef{},
		suggests: map[int64]map[string]legacyRichSuggestRef{},
	}
	for _, item := range items {
		if resolver.items[item.TypeID] == nil {
			resolver.items[item.TypeID] = map[string][]legacyRichItemRef{}
		}
		for _, value := range []string{item.NameEn, item.Name} {
			key := legacyRichKey(value)
			if key == "" {
				continue
			}
			resolver.items[item.TypeID][key] = append(resolver.items[item.TypeID][key], item)
		}
	}
	for typeID := range resolver.items {
		for key := range resolver.items[typeID] {
			sort.Slice(resolver.items[typeID][key], func(i, j int) bool {
				return resolver.items[typeID][key][i].ID < resolver.items[typeID][key][j].ID
			})
		}
	}
	for _, suggest := range suggests {
		if resolver.suggests[suggest.TypeID] == nil {
			resolver.suggests[suggest.TypeID] = map[string]legacyRichSuggestRef{}
		}
		for _, value := range []string{suggest.Code, suggest.Value} {
			key := legacyRichKey(value)
			if key != "" {
				resolver.suggests[suggest.TypeID][key] = suggest
			}
		}
	}
	return resolver
}

func legacyRichKey(value string) string {
	if decoded, err := url.PathUnescape(strings.TrimSpace(value)); err == nil {
		value = decoded
	}
	value = strings.ToLower(strings.ReplaceAll(value, "ё", "е"))
	var out strings.Builder
	separator := false
	for _, r := range value {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			if separator && out.Len() > 0 {
				out.WriteByte('_')
			}
			out.WriteRune(r)
			separator = false
		} else {
			separator = true
		}
	}
	return strings.Trim(out.String(), "_")
}

func legacyHrefParts(href string) (route, slug string) {
	value := strings.TrimSpace(href)
	if parsed, err := url.Parse(value); err == nil && parsed.Path != "" {
		value = parsed.Path
	}
	if decoded, err := url.PathUnescape(value); err == nil {
		value = decoded
	}
	parts := strings.FieldsFunc(value, func(r rune) bool { return r == '/' || r == '\\' })
	if len(parts) == 0 {
		return "", legacyRichKey(value)
	}
	known := map[string]bool{
		"screen": true, "screens": true, "spell": true, "spells": true,
		"bestiary": true, "creatures": true, "items": true, "weapons": true,
		"armors": true, "traits": true, "races": true, "classes": true,
	}
	for i := len(parts) - 2; i >= 0; i-- {
		candidate := strings.ToLower(parts[i])
		if known[candidate] {
			return candidate, legacyRichKey(parts[len(parts)-1])
		}
	}
	if len(parts) == 1 {
		return "", legacyRichKey(parts[0])
	}
	return strings.ToLower(parts[len(parts)-2]), legacyRichKey(parts[len(parts)-1])
}

func legacyItemTypes(tooltipType, route string) []int64 {
	typeKey := legacyRichKey(tooltipType)
	routeKey := legacyRichKey(route)
	switch {
	case typeKey == "spell" || routeKey == "spell" || routeKey == "spells":
		return []int64{5}
	case typeKey == "creature" || routeKey == "bestiary" || routeKey == "creatures":
		return []int64{6}
	case typeKey == "weapon" || routeKey == "weapons":
		return []int64{1}
	case typeKey == "armor" || routeKey == "armors":
		return []int64{2}
	case typeKey == "magic_item" || typeKey == "item" || routeKey == "items":
		return []int64{2, 10}
	case typeKey == "trait" || routeKey == "traits":
		return []int64{7, 3, 4}
	case routeKey == "races":
		return []int64{8}
	case routeKey == "classes":
		return []int64{9}
	default:
		return nil
	}
}

func (resolver *legacyRichResolver) resolveItem(tooltipType, href, label string) (legacyRichItemRef, bool) {
	route, slug := legacyHrefParts(href)
	typeIDs := legacyItemTypes(tooltipType, route)
	if len(typeIDs) == 0 {
		return legacyRichItemRef{}, false
	}
	keys := []string{slug}
	if matches := legacyEnglishLabelRE.FindAllStringSubmatch(label, -1); len(matches) > 0 {
		keys = append(keys, legacyRichKey(matches[len(matches)-1][1]))
	}
	keys = append(keys, legacyRichKey(label))
	for _, typeID := range typeIDs {
		for _, key := range keys {
			if candidates := resolver.items[typeID][key]; len(candidates) > 0 {
				// Legacy URLs did not encode a source edition. The oldest matching
				// base row is the deterministic canonical target used by the import.
				return candidates[0], true
			}
		}
	}
	return legacyRichItemRef{}, false
}

func (resolver *legacyRichResolver) resolveSuggest(href string) (legacyRichSuggestRef, bool) {
	route, slug := legacyHrefParts(href)
	if route != "screen" && route != "screens" && route != "" {
		return legacyRichSuggestRef{}, false
	}
	target, ok := legacyScreenSuggests[slug]
	if !ok {
		return legacyRichSuggestRef{}, false
	}
	suggest, ok := resolver.suggests[target.TypeID][legacyRichKey(target.Value)]
	return suggest, ok
}
