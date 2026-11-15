package main

import (
	"encoding/json"
	"testing"
)

func TestAbilityBonusSchemaPreservesOtherFieldsAndIsIdempotent(t *testing.T) {
	var schema []any
	if err := json.Unmarshal([]byte(`[{"key":"other","default":7},{"key":"derived_effects","fields":[{"key":"kind","options":[{"value":"ability_minimum","label":"Свой текст"}]},{"key":"value","type":"int"},{"key":"ability_ids","type":"suggest_array"}]}]`), &schema); err != nil {
		t.Fatal(err)
	}
	if err := extendAbilityBonus(schema); err != nil {
		t.Fatal(err)
	}
	rules := rows(named(schema, "key", "derived_effects"), "fields")
	options := rows(named(rules, "key", "kind"), "options")
	if len(options) != 2 || named(options, "value", "ability_bonus") == nil || named(options, "value", "ability_minimum")["label"] != "Свой текст" || named(schema, "key", "other")["default"] != float64(7) {
		t.Fatal(schema)
	}
	first, _ := json.Marshal(schema)
	if err := extendAbilityBonus(schema); err != nil {
		t.Fatal(err)
	}
	second, _ := json.Marshal(schema)
	if string(first) != string(second) {
		t.Fatal("reapplying changed schema")
	}
}

func TestAbilityBonusSchemaRejectsMissingRuleDefinition(t *testing.T) {
	if err := extendAbilityBonus(nil); err == nil {
		t.Fatal("missing schema accepted")
	}
}
