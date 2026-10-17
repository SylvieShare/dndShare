package store

import (
	"encoding/json"

	"testing"
)

func TestPublicOrOwnedPredicate(t *testing.T) {
	if got := publicOrOwnedPredicate("i", nil, 1); got != "i.user_id IS NULL" {
		t.Fatalf("anonymous/API predicate leaks private rows: %s", got)
	}
	uid := int64(42)
	got := publicOrOwnedPredicate("s", &uid, 7)
	if got != "(s.user_id IS NULL OR s.user_id = $7)" {
		t.Fatalf("authenticated predicate does not isolate owner: %s", got)
	}
}

func TestCanonicalItemDataRemovesLegacyCustomSourceKeys(t *testing.T) {
	got := canonicalItemData(json.RawMessage(`{"customSourceId":9,"custom_source_id":10,"name":"kept"}`))
	var object map[string]any
	if err := json.Unmarshal(got, &object); err != nil {
		t.Fatal(err)
	}
	if _, ok := object["customSourceId"]; ok {
		t.Fatal("camelCase custom source relation remained in item JSON")
	}
	if _, ok := object["custom_source_id"]; ok {
		t.Fatal("snake_case custom source relation remained in item JSON")
	}
	if object["name"] != "kept" {
		t.Fatalf("unrelated item data changed: %s", got)
	}
}
