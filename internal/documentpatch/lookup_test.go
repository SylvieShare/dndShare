package documentpatch

import (
	"encoding/json"
	"testing"
)

func TestLookupUsesStableIdentityAndDistinguishesMissingFromNull(t *testing.T) {
	doc, err := Decode([]byte(`{"values":{"rows":[{"id":2,"count":1},{"id":1,"count":null}]}}`))
	if err != nil {
		t.Fatal(err)
	}
	path := []any{"values", "rows", map[string]any{"idField": "id", "id": json.Number("1")}, "count"}
	value, exists, err := Lookup(doc, path)
	if err != nil || !exists || value != nil {
		t.Fatal(value, exists, err)
	}
	path[2] = map[string]any{"idField": "id", "id": json.Number("9")}
	if _, exists, err := Lookup(doc, path); err != nil || exists {
		t.Fatal(exists, err)
	}
	if _, _, err := Lookup(doc, []any{"values", "__proto__"}); err == nil {
		t.Fatal("unsafe path accepted")
	}
	duplicate, _ := Decode([]byte(`{"rows":[{"id":1},{"id":1}]}`))
	if _, _, err := Lookup(duplicate, []any{"rows", map[string]any{"idField": "id", "id": json.Number("1")}}); err == nil {
		t.Fatal("duplicate selector accepted")
	}
}
