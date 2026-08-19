package store

import (
	"strings"
	"testing"
)

func TestHandbookFiltersSchemaIsEmbeddedAndOrdered(t *testing.T) {
	positions := map[string]int{}
	for index, part := range schemaParts {
		positions[part.name] = index
		if part.name == "handbook-filters" {
			if part.sql == "" || part.sql != schemaHandbookFiltersSQL {
				t.Fatal("handbook filter schema must be embedded in schemaParts")
			}
		}
	}
	if _, exists := positions["handbook-filters"]; !exists {
		t.Fatal("handbook filter schema must run during startup")
	}
	if positions["handbook-filters"] <= positions["rich-content"] ||
		positions["handbook-filters"] >= positions["session-timers"] {
		t.Fatal("handbook filter schema must run between rich content and session timers")
	}
}

func TestHandbookFiltersSchemaExposesUsefulBestiaryFilters(t *testing.T) {
	for _, fragment := range []string{
		"'creature_type', 'size', 'environment', 'is_legendary', 'named_npc'",
		"field ->> 'key' = 'cr'",
		`{"name":"Классы","filter":true,"filter_path":"classes.id","filter_item_type":9}`,
		"'filter_values'",
		`["0","1/8","1/4","1/2","1"`,
		"field - 'filter' - 'filter_values'",
	} {
		if !strings.Contains(schemaHandbookFiltersSQL, fragment) {
			t.Fatalf("handbook filter schema must contain %q", fragment)
		}
	}
}
