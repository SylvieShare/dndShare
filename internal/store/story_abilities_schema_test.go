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
