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
	var levelFields []any
	if err := json.Unmarshal([]byte(strings.Split(schemaAbilityRuleLinksSQL, "$level_fields$")[1]), &levelFields); err != nil {
		t.Fatal(err)
	}
	for _, raw := range want.([]any) {
		field := raw.(map[string]any)
		if field["key"] == "weapon_damage" {
			field["fields"] = append(field["fields"].([]any), map[string]any{"name": "Ключ", "key": "key", "type": "text", "required": true})
		}
		if field["key"] == "sheet_widgets" {
			field["fields"] = append(field["fields"].([]any), map[string]any{"name": "Правило урона", "key": "weapon_damage_key", "type": "text", "show_on": map[string]any{"key": "value_source", "value": "weapon_damage"}})
		}
	}
	want = append(want.([]any), levelFields...)
	var dependencyPatch map[string]any
	if err := json.Unmarshal([]byte(strings.Split(schemaAbilityDependencyEditorSQL, "$dependency_fields$")[1]), &dependencyPatch); err != nil {
		t.Fatal(err)
	}
	for index, raw := range want.([]any) {
		if replacement, ok := dependencyPatch[raw.(map[string]any)["key"].(string)]; ok {
			want.([]any)[index] = replacement
		}
	}
	var conditionalFields []any
	if err := json.Unmarshal([]byte(strings.Split(schemaConditionalWeaponDamageSQL, "$fields$")[1]), &conditionalFields); err != nil {
		t.Fatal(err)
	}
	for _, raw := range want.([]any) {
		field := raw.(map[string]any)
		if field["key"] == "weapon_damage" {
			field["fields"] = append(conditionalFields, field["fields"].([]any)...)
		}
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
