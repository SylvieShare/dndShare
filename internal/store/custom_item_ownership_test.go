package store

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestHandbookSchemaDefinesCustomItemOwnershipMigration(t *testing.T) {
	required := []string{
		"CREATE TABLE IF NOT EXISTS dndshare.custom_item_source",
		"custom_item_source_user_default_key",
		"WHERE is_default",
		"users_default_custom_item_source",
		"ADD COLUMN IF NOT EXISTS custom_source_id",
		"FOREIGN KEY (custom_source_id, user_id)",
		"REFERENCES dndshare.custom_item_source(id, user_id)",
		"CHECK ((user_id IS NULL) = (custom_source_id IS NULL))",
		"SET custom_source_id = cis.id",
		"data - 'customSourceId' - 'custom_source_id'",
	}
	for _, fragment := range required {
		if !strings.Contains(schemaHandbookSQL, fragment) {
			t.Errorf("handbook schema is missing ownership migration fragment %q", fragment)
		}
	}
}

func TestSuggestSchemaUsesConcurrencySafePublicSequence(t *testing.T) {
	for _, fragment := range []string{
		"CREATE SEQUENCE IF NOT EXISTS dndshare.suggest_public_id_seq",
		"DEFAULT nextval('dndshare.suggest_public_id_seq'::regclass)",
		"CONSTRAINT suggest_pk PRIMARY KEY (type_id, id)",
	} {
		if !strings.Contains(schemaHandbookSQL, fragment) {
			t.Errorf("handbook schema is missing suggest identity fragment %q", fragment)
		}
	}
	if !strings.Contains(schemaSeedSQL, "'dndshare.suggest_public_id_seq'") {
		t.Fatal("seed schema must advance the suggest sequence after explicit base ids")
	}
}

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
