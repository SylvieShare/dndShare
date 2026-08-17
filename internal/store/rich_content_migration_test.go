package store

import (
	"encoding/json"
	"net/url"
	"regexp"
	"strings"
	"testing"
)

func richMigrationTestResolver() *legacyRichResolver {
	return newLegacyRichResolver(
		[]legacyRichItemRef{
			{ID: 501, TypeID: 5, Name: "Огненный шар", NameEn: "fireball"},
			{ID: 601, TypeID: 6, Name: "Кобольд", NameEn: "kobold"},
			{ID: 201, TypeID: 2, Name: "Зелье полёта", NameEn: "potion_of_flying"},
		},
		[]legacyRichSuggestRef{
			{ID: 10, TypeID: 15, Value: "Внимание"},
			{ID: 4, TypeID: 9, Value: "Захват"},
		},
	)
}

func decodeMigratedPayload(t *testing.T, html, kind string) map[string]any {
	t.Helper()
	re := regexp.MustCompile(`data-rich-node="` + regexp.QuoteMeta(kind) + `" data-rich-payload="([^"]+)"`)
	match := re.FindStringSubmatch(html)
	if len(match) != 2 {
		t.Fatalf("missing %s payload in %s", kind, html)
	}
	decoded, err := url.QueryUnescape(match[1])
	if err != nil {
		t.Fatalf("decode %s payload: %v", kind, err)
	}
	var payload map[string]any
	if err := json.Unmarshal([]byte(decoded), &payload); err != nil {
		t.Fatalf("unmarshal %s payload: %v", kind, err)
	}
	return payload
}

func TestConvertLegacyRichHTMLMigratesDiceAverageAndLinks(t *testing.T) {
	source := `<p><em>Попадание:</em>&nbsp;13&nbsp;(<dice-roller label="Урон" formula="2к8 + 4"/>) урона; ` +
		`<detail-tooltip type="spell"><a href="/spells/Fireball"><em>огненный шар [fireball]</em></a></detail-tooltip>; ` +
		`<detail-tooltip type="screen"><a href="/screens/perception">Мудрости (Внимательность)</a></detail-tooltip>; ` +
		`<detail-tooltip type="screen"><a href="/screens/long_rest">длительный отдых</a></detail-tooltip>.</p>`
	conversion := legacyRichConversion{}
	converted, changed, err := convertLegacyRichHTML(source, richMigrationTestResolver(), &conversion)
	if err != nil {
		t.Fatal(err)
	}
	if !changed {
		t.Fatal("legacy html was not changed")
	}
	if strings.Contains(converted, "dice-roller") || strings.Contains(converted, "detail-tooltip") {
		t.Fatalf("legacy tags remain: %s", converted)
	}
	if strings.Contains(converted, "13&nbsp;(") || strings.Contains(converted, ") урона") {
		t.Fatalf("average parentheses remain: %s", converted)
	}
	dice := decodeMigratedPayload(t, converted, "dice")
	if dice["formula"] != "2к8 + 4" || dice["label"] != "Урон" || dice["average"] != float64(13) {
		t.Fatalf("unexpected dice payload: %#v in %s", dice, converted)
	}
	item := decodeMigratedPayload(t, converted, "item")
	if item["id"] != float64(501) || item["typeId"] != float64(5) {
		t.Fatalf("unexpected item payload: %#v", item)
	}
	suggest := decodeMigratedPayload(t, converted, "suggest")
	if suggest["id"] != float64(10) || suggest["typeId"] != float64(15) {
		t.Fatalf("unexpected suggest payload: %#v", suggest)
	}
	if !strings.Contains(converted, `href="https://ttg.club/screens/long_rest"`) {
		t.Fatalf("unresolved legacy link was not made native: %s", converted)
	}
	if conversion != (legacyRichConversion{DiceNodes: 1, DiceAverages: 1, ItemNodes: 1, SuggestNodes: 1, NativeLinks: 1}) {
		t.Fatalf("unexpected conversion stats: %#v", conversion)
	}
}

func TestConvertLegacyRichHTMLHandlesPairedDiceAndItemKinds(t *testing.T) {
	source := `<p><dice-roller label="Атака" formula="к20 + 5">+5</dice-roller> ` +
		`<a href="/bestiary/kobold">кобольд</a> ` +
		`<a href="/items/potion_of_flying">зелье</a></p>`
	conversion := legacyRichConversion{}
	converted, changed, err := convertLegacyRichHTML(source, richMigrationTestResolver(), &conversion)
	if err != nil {
		t.Fatal(err)
	}
	if !changed || strings.Contains(converted, "dice-roller") || strings.Contains(converted, "<a ") {
		t.Fatalf("legacy nodes remain: %s", converted)
	}
	dice := decodeMigratedPayload(t, converted, "dice")
	if dice["formula"] != "к20 + 5" || dice["label"] != "Атака" {
		t.Fatalf("unexpected dice payload: %#v", dice)
	}
	if strings.Count(converted, `data-rich-node="item"`) != 2 {
		t.Fatalf("expected two item nodes: %s", converted)
	}
}

func TestConvertLegacyRichJSONIsRecursiveAndIdempotent(t *testing.T) {
	value := map[string]any{
		"description": `<p><dice-roller formula="1d6*5">1к6 × 5</dice-roller></p>`,
		"actions": []any{map[string]any{
			"value": `<p><detail-tooltip type="screen"><a href="/screens/grappled">схвачен</a></detail-tooltip></p>`,
		}},
	}
	conversion := legacyRichConversion{}
	changed, err := convertLegacyRichJSON(value, richMigrationTestResolver(), &conversion)
	if err != nil {
		t.Fatal(err)
	}
	if !changed || conversion.DiceNodes != 1 || conversion.SuggestNodes != 1 {
		t.Fatalf("unexpected first conversion: changed=%v stats=%#v", changed, conversion)
	}
	second := legacyRichConversion{}
	changed, err = convertLegacyRichJSON(value, richMigrationTestResolver(), &second)
	if err != nil {
		t.Fatal(err)
	}
	if changed || second != (legacyRichConversion{}) {
		t.Fatalf("conversion is not idempotent: changed=%v stats=%#v", changed, second)
	}
}

func TestConvertLegacyRichHTMLNormalizesKnownFormulaTypo(t *testing.T) {
	converted, changed, err := convertLegacyRichHTML(
		`<p><dice-roller formula="1к6 + 3 + 1r8"/></p>`,
		richMigrationTestResolver(),
		&legacyRichConversion{},
	)
	if err != nil {
		t.Fatal(err)
	}
	if !changed {
		t.Fatal("formula was not migrated")
	}
	payload := decodeMigratedPayload(t, converted, "dice")
	if payload["formula"] != "1к6 + 3 + 1к8" {
		t.Fatalf("formula typo remains: %#v", payload)
	}
}
