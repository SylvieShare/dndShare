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
	last := schemaParts[len(schemaParts)-2]
	if last.name != "story-abilities" || last.sql != schemaStoryAbilitiesSQL {
		t.Fatal("story abilities must run after existing catalogue migrations")
	}
}
