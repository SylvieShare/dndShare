package documentpatch

import (
	"encoding/json"
	"strconv"
	"testing"
)

func TestLargeRotationRemainsAtomicAndUndoable(t *testing.T) {
	tiles, rotated := make([]map[string]any, 4096), make([]map[string]any, 4096)
	for i := range tiles {
		x, y := i%64, i/64
		tiles[i] = map[string]any{"id": strconv.Itoa(i), "x": x, "y": y, "rotation": 0}
		rotated[i] = map[string]any{"id": strconv.Itoa(i), "x": 63 - y, "y": x, "rotation": 90}
	}
	before, _ := json.Marshal(map[string]any{"document": map[string]any{"tiles": tiles}})
	after, _ := json.Marshal(map[string]any{"document": map[string]any{"tiles": rotated}})
	for _, pair := range [][2]json.RawMessage{{before, after}, {after, before}} {
		patches, err := Diff(pair[0], pair[1])
		if err != nil || len(patches) != 1 || patches[0].Op != "set" || len(patches[0].Path) != 2 || patches[0].Path[1] != "tiles" {
			t.Fatalf("large action must replace its collection: %v, %v", len(patches), err)
		}
		result, err := Apply(pair[0], patches)
		if err != nil {
			t.Fatal(err)
		}
		expected, _ := Decode(pair[1])
		actual, _ := Decode(result)
		if !Equal(expected, actual) {
			t.Fatal("large action lost values")
		}
	}
}
