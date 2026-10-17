package store

import (
	"encoding/json"
	"os"
	"path/filepath"

	"testing"
)

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
