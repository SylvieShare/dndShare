package store

import (
	"encoding/json"
	"os"
	"reflect"
	"strings"
	"testing"
)

func TestAbilityCataloguesShareMigrationSchema(t *testing.T) {
	parts := strings.Split(schemaStoryAbilitiesSQL, "$abilities$")
	if len(parts) != 3 {
		t.Fatal("ability schema snapshot is missing")
	}
	var want any
	if err := json.Unmarshal([]byte(parts[1]), &want); err != nil {
		t.Fatal(err)
	}
	// Migration 77 replaces combinatorial menu captions with independent toggles.
	// The historical migration 72 snapshot itself remains immutable.
	for _, raw := range want.([]any) {
		field := raw.(map[string]any)
		if field["key"] != "weapon_damage" {
			continue
		}
		var fields []any
		for _, rawChild := range field["fields"].([]any) {
			child := rawChild.(map[string]any)
			if child["key"] != "menu_label" && child["key"] != "critical_menu_label" {
				fields = append(fields, child)
			}
		}
		field["fields"] = fields
	}
	for _, name := range []string{"3", "4", "18"} {
		data, err := os.ReadFile("../../resources/items/item_" + name + "_shema.json")
		if err != nil {
			t.Fatal(err)
		}
		var actual any
		if err := json.Unmarshal(data, &actual); err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(want, actual) {
			t.Fatalf("ability catalogue %s differs from migration snapshot", name)
		}
	}
	for _, part := range schemaParts {
		if part.name == "story-abilities" && part.sql == schemaStoryAbilitiesSQL {
			return
		}
	}
	t.Fatal("story abilities migration must be registered")
}
