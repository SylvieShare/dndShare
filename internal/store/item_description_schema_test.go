package store

import (
	"regexp"
	"strings"
	"testing"
)

func TestItemRichDescriptionSchemaCoversTheAuditedCatalog(t *testing.T) {
	sql := schemaItemRichDescriptionsSQL
	for _, fragment := range []string{
		"item_description_seed",
		"Waterskin",
		"кожаный бурдюк с пробкой",
		"efreeti bottle",
		"<table><thead><tr><th>d100</th><th>Результат</th>",
		"data ->> 'desc' LIKE '%покупаемое снаряжение из Книги игрока (2014)%'",
	} {
		if !strings.Contains(sql, fragment) {
			t.Fatalf("item description migration must contain %q", fragment)
		}
	}
	seedStart := strings.Index(sql, "SELECT * FROM (VALUES")
	seedEnd := strings.Index(sql, ") AS seed(name_en, description);")
	if seedStart < 0 || seedEnd <= seedStart {
		t.Fatal("item description seed is missing")
	}
	seedRows := regexp.MustCompile(`(?m)^\s*\('`).FindAllStringIndex(sql[seedStart:seedEnd], -1)
	if len(seedRows) < 112 {
		t.Fatalf("audited English-name seed is incomplete: got %d rows", len(seedRows))
	}
	for _, id := range []string{"(71::bigint,", "(72,", "(73,", "(74,", "(1423,", "(1425,", "(1426,", "(1427,", "(1429,", "(1431,", "(1432,", "(1433,"} {
		if !strings.Contains(sql, id) {
			t.Fatalf("legacy helper description is missing for %s", id)
		}
	}
}
