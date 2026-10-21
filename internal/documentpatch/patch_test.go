package documentpatch

import (
	"encoding/json"
	"os"
	"testing"
)

func TestNestedCollectionsAndInverse(t *testing.T) {
	before := json.RawMessage(`{"sections":[{"id":"s","items":[{"uid":"a","count":1},{"uid":"b","count":2},{"uid":"c","count":3}]}],"nullable":null}`)
	after := json.RawMessage(`{"sections":[{"id":"s","items":[{"uid":"c","count":3},{"uid":"d","count":4},{"uid":"a","count":8}]}],"extra":false}`)
	ops, err := Diff(before, after)
	if err != nil {
		t.Fatal(err)
	}
	result, err := Apply(before, ops)
	if err != nil {
		t.Fatal(err)
	}
	a, _ := Decode(after)
	b, _ := Decode(result)
	if !Equal(a, b) {
		t.Fatal(string(result))
	}
	inverse, _ := Diff(after, before)
	result, err = Apply(result, inverse)
	if err != nil {
		t.Fatal(err)
	}
	a, _ = Decode(before)
	b, _ = Decode(result)
	if !Equal(a, b) {
		t.Fatal(string(result))
	}
}
func TestRejectUnsafeAndMissingTargets(t *testing.T) {
	for _, patch := range []string{`[{"op":"set","path":["__proto__","x"],"value":1}]`, `[{"op":"remove","path":["items",{"idField":"id","id":"absent"}]}]`, `[{"op":"insert","path":["items",{"idField":"id","id":"x"}],"value":{"id":"x"}}]`} {
		var ops []Operation
		if err := json.Unmarshal([]byte(patch), &ops); err != nil {
			t.Fatal(err)
		}
		if _, err := Apply(json.RawMessage(`{"items":[{"id":"x"}]}`), ops); err == nil {
			t.Fatal("unsafe patch accepted", patch)
		}
	}
}

func TestSharedBrowserContract(t *testing.T) {
	raw, err := os.ReadFile("testdata/contract.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		Name          string
		Before, After json.RawMessage
		Patches       []Operation
		ApplyOnly     bool
	}
	if err = json.Unmarshal(raw, &cases); err != nil {
		t.Fatal(err)
	}
	for _, test := range cases {
		t.Run(test.Name, func(t *testing.T) {
			result, err := Apply(test.Before, test.Patches)
			if err != nil {
				t.Fatal(err)
			}
			expected, _ := Decode(test.After)
			actual, _ := Decode(result)
			if !Equal(expected, actual) {
				t.Fatalf("apply: %s", result)
			}
			if !test.ApplyOnly {
				patches, err := Diff(test.Before, test.After)
				if err != nil {
					t.Fatal(err)
				}
				encoded, _ := json.Marshal(patches)
				golden, _ := json.Marshal(test.Patches)
				a, _ := Decode(encoded)
				b, _ := Decode(golden)
				if !Equal(a, b) {
					t.Fatalf("browser/server diff mismatch:\n%s\n%s", encoded, golden)
				}
			}
		})
	}
}
