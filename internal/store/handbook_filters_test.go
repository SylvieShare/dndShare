package store

import (
	"encoding/json"
	"os"
	"path/filepath"
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

func TestHandbookFiltersSchemaExposesUsefulCatalogueFilters(t *testing.T) {
	for _, fragment := range []string{
		"'creature_type', 'size', 'environment', 'is_legendary', 'named_npc'",
		"field ->> 'key' = 'cr'",
		`{"name":"Классы","filter":true,"filter_path":"classes.id","filter_item_type":9}`,
		`{"name":"Расы","filter":true,"filter_path":"race_ids.id","filter_item_type":8}`,
		`{"name":"Классы","filter":true,"filter_path":"class_ids.id","filter_item_type":9}`,
		"'filter_values'",
		`["0","1/8","1/4","1/2","1"`,
		"field - 'filter' - 'filter_values'",
	} {
		if !strings.Contains(schemaHandbookFiltersSQL, fragment) {
			t.Fatalf("handbook filter schema must contain %q", fragment)
		}
	}
}

func TestAbilityResourceSchemasExposeOwnerFilters(t *testing.T) {
	tests := []struct {
		typeID         string
		fieldKey       string
		filterPath     string
		filterItemType float64
	}{
		{typeID: "3", fieldKey: "race_ids", filterPath: "race_ids.id", filterItemType: 8},
		{typeID: "4", fieldKey: "class_ids", filterPath: "class_ids.id", filterItemType: 9},
	}

	for _, tt := range tests {
		path := filepath.Join("..", "..", "resources", "items", "item_"+tt.typeID+"_shema.json")
		contents, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("read ability schema %s: %v", tt.typeID, err)
		}
		var fields []map[string]any
		if err := json.Unmarshal(contents, &fields); err != nil {
			t.Fatalf("parse ability schema %s: %v", tt.typeID, err)
		}

		var ownerField map[string]any
		for _, field := range fields {
			if field["key"] == tt.fieldKey {
				ownerField = field
				break
			}
		}
		if ownerField == nil || ownerField["filter"] != true ||
			ownerField["filter_path"] != tt.filterPath ||
			ownerField["filter_item_type"] != tt.filterItemType {
			t.Fatalf("ability schema %s must expose owner filter: %#v", tt.typeID, ownerField)
		}
	}
}
