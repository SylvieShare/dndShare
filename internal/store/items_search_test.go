package store

import (
	"strings"
	"testing"
)

func TestItemNameSearchPredicateUsesRussianAndEnglishNames(t *testing.T) {
	predicate := itemNameSearchPredicate("i", "$4")
	for _, fragment := range []string{
		"i.name ILIKE $4",
		"COALESCE(i.name_en, '') ILIKE $4",
		" OR ",
	} {
		if !strings.Contains(predicate, fragment) {
			t.Fatalf("item search predicate must contain %q: %s", fragment, predicate)
		}
	}
}
