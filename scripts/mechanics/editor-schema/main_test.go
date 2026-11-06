package main

import (
	"encoding/json"
	"testing"
)

func TestFeatCanRecreateSharedRulesAndPreservesLocalFields(t *testing.T) {
	var feat, class []any
	parse := func(raw string, dst *[]any) {
		t.Helper()
		if err := json.Unmarshal([]byte(raw), dst); err != nil {
			t.Fatal(err)
		}
	}
	parse(`[{"key":"other","default":7},{"key":"derived_effects","fields":[{"key":"kind","options":[{"value":"armor_bonus","label":"Свой текст"}]}]}]`, &feat)
	parse(`[{"key":"derived_effects","fields":[{"key":"kind","options":[{"value":"language_proficiency","label":"Язык"}]},{"key":"target_ids","type":"text_array"}]},{"key":"scaling","type":"object_array"}]`, &class)
	result, err := update(feat, 7, class)
	if err != nil {
		t.Fatal(err)
	}
	rules := rows(named(result, "key", "derived_effects"), "fields")
	options := rows(named(rules, "key", "kind"), "options")
	if named(options, "value", "language_proficiency") == nil || named(rules, "key", "target_ids") == nil ||
		named(options, "value", "armor_bonus")["label"] != "Свой текст" || named(result, "key", "scaling") == nil ||
		named(result, "key", "other")["default"] != float64(7) {
		t.Fatal(result)
	}
	before, _ := json.Marshal(result)
	result, err = update(result, 7, class)
	after, _ := json.Marshal(result)
	if err != nil || string(before) != string(after) {
		t.Fatalf("second application changed the schema: %v", err)
	}
}

func TestStatusDurationKeepsUnitsAndExposesCustomText(t *testing.T) {
	var schema []any
	err := json.Unmarshal([]byte(`[{"key":"duration","fields":[{"key":"kind","options":[{"value":"hours"}]}]}]`), &schema)
	if err != nil {
		t.Fatal(err)
	}
	result, err := update(schema, 15, nil)
	if err != nil {
		t.Fatal(err)
	}
	fields := rows(named(result, "key", "duration"), "fields")
	if len(rows(named(fields, "key", "kind"), "options")) != 2 || named(fields, "key", "text") == nil {
		t.Fatal(fields)
	}
}
