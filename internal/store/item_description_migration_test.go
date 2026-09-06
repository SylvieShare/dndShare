package store

import (
	"strings"
	"testing"
)

func itemDescriptionTestResolver() *legacyRichResolver {
	return newLegacyRichResolver(
		[]legacyRichItemRef{
			{ID: 101, TypeID: 5, Name: "Огненный шар", NameEn: "Fireball"},
			{ID: 102, TypeID: 5, Name: "Желание", NameEn: "Wish"},
			{ID: 201, TypeID: 6, Name: "Ифрит", NameEn: "Efreeti"},
			{ID: 301, TypeID: 15, Name: "Отравление", NameEn: "Poisoned"},
			{ID: 401, TypeID: 2, Name: "Сфера аннигиляции", NameEn: "Sphere of Annihilation"},
		},
		nil,
	)
}

func TestConvertItemDescriptionBuildsRichTableAndInlineNodes(t *testing.T) {
	resolver := itemDescriptionTestResolver()
	references := buildDescriptionReferences(resolver)
	conversion := descriptionConversion{}
	source := "Мастер бросает d100 и сверяется с таблицей. У цепи КД 19 и 10 хитов.\\n" +
		"| d100 | Эффект |\\n|---|---|\\n| 01–50 | Ифрит творит заклинание Огненный шар. |\\n" +
		"| 51–100 | Открывается Сфера аннигиляции. |"

	converted, changed, err := convertItemDescription(source, 999, resolver, references, &conversion)
	if err != nil {
		t.Fatal(err)
	}
	if !changed {
		t.Fatal("description was not converted")
	}
	for _, fragment := range []string{
		"<table>", "<thead>", "<tbody>",
		`data-rich-node="dice"`, `data-rich-node="stat"`, `data-rich-node="item"`,
		`%22formula%22%3A%22d100%22`, `%22stat%22%3A%22ac%22`, `%22stat%22%3A%22hp%22`,
		`%22id%22%3A201`, `%22id%22%3A101`, `%22id%22%3A401`,
	} {
		if !strings.Contains(converted, fragment) {
			t.Fatalf("converted description must contain %q: %s", fragment, converted)
		}
	}
	if conversion.DiceNodes != 2 || conversion.StatNodes != 2 || conversion.ItemLinks != 3 {
		t.Fatalf("unexpected conversion stats: %#v", conversion)
	}
}

func TestConvertItemDescriptionRemovesExternalAndBrokenLinks(t *testing.T) {
	resolver := itemDescriptionTestResolver()
	conversion := descriptionConversion{}
	converted, changed, err := convertItemDescription(
		`<p><a href="https://example.com/rule">внешнее правило</a>, <a href="/missing">сломанная ссылка</a></p>`,
		999,
		resolver,
		buildDescriptionReferences(resolver),
		&conversion,
	)
	if err != nil {
		t.Fatal(err)
	}
	if !changed || strings.Contains(converted, "<a") || strings.Contains(converted, "href=") {
		t.Fatalf("unsafe links remain: %s", converted)
	}
	if !strings.Contains(converted, "внешнее правило") || !strings.Contains(converted, "сломанная ссылка") {
		t.Fatalf("link labels were lost: %s", converted)
	}
	if conversion.LinksClean != 2 {
		t.Fatalf("unexpected removed link count: %#v", conversion)
	}
}

func TestConvertItemDescriptionRepairsMarkdownTableInsideImportedHTML(t *testing.T) {
	resolver := itemDescriptionTestResolver()
	conversion := descriptionConversion{}
	source := `<p><span style="font-family: inherit;">Рычаги\n| Рычаг | Эффект |\n|---|---|\n| 1 | Урон 2d6. |</span></p>`
	converted, changed, err := convertItemDescription(source, 999, resolver, buildDescriptionReferences(resolver), &conversion)
	if err != nil {
		t.Fatal(err)
	}
	if !changed || !strings.Contains(converted, "<table>") || strings.Contains(converted, "|---") {
		t.Fatalf("mixed markdown table was not repaired: %s", converted)
	}
	if conversion.DiceNodes != 1 {
		t.Fatalf("table formula was not converted: %#v", conversion)
	}
}

func TestConvertItemDescriptionIsIdempotent(t *testing.T) {
	resolver := itemDescriptionTestResolver()
	references := buildDescriptionReferences(resolver)
	firstStats := descriptionConversion{}
	converted, _, err := convertItemDescription(`Урон 1d4 + 4, осталось 2 хита.`, 999, resolver, references, &firstStats)
	if err != nil {
		t.Fatal(err)
	}
	secondStats := descriptionConversion{}
	second, changed, err := convertItemDescription(converted, 999, resolver, references, &secondStats)
	if err != nil {
		t.Fatal(err)
	}
	if changed || second != converted || secondStats != (descriptionConversion{}) {
		t.Fatalf("conversion is not idempotent\nfirst: %s\nsecond: %s\nstats: %#v", converted, second, secondStats)
	}
}
