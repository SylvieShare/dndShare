package documentsync

import (
	"encoding/json"
	"fmt"
	"testing"
)

func TestReplayAndLostBuffer(t *testing.T) {
	cache := New()
	before := Snapshot{Data: json.RawMessage(`{"a":1}`), Version: 1}
	after := Snapshot{Data: json.RawMessage(`{"a":2}`), Version: 2}
	mutation := Mutation{BaseVersion: 1, MutationID: "id"}
	if _, err := cache.Record("map", mutation, before, after); err != nil {
		t.Fatal(err)
	}
	if update := cache.Since("map", 1, after); update.Data != nil || len(update.Patches) != 1 {
		t.Fatal(update)
	}
	if update := New().Since("map", 1, after); update.Data == nil {
		t.Fatal("missing replay must return a snapshot")
	}
	if _, ok, match := cache.Receipt("map", "id", mutation.Fingerprint()); !ok || !match {
		t.Fatal("receipt missing")
	}
	if _, ok, match := cache.Receipt("map", "id", "other"); !ok || match {
		t.Fatal("changed retry accepted")
	}
}

func TestReplayDoesNotOvertakeReadSnapshot(t *testing.T) {
	cache := New()
	first := Snapshot{Data: json.RawMessage(`{"x":1}`), Version: 1}
	second := Snapshot{Data: json.RawMessage(`{"x":2}`), Version: 2}
	third := Snapshot{Data: json.RawMessage(`{"x":3}`), Version: 3}
	_, _ = cache.Record("map", Mutation{MutationID: "one"}, first, second)
	_, _ = cache.Record("map", Mutation{MutationID: "two"}, second, third)
	update := cache.Since("map", 1, second)
	if update.Data != nil || len(update.Patches) != 1 || update.Version != 2 {
		t.Fatalf("read raced with a later commit: %+v", update)
	}
}
func TestReplayBufferBounds(t *testing.T) {
	cache := New()
	for i := 0; i < 300; i++ {
		before := Snapshot{Data: json.RawMessage(fmt.Sprintf(`{"x":%d}`, i)), Version: int64(i)}
		after := Snapshot{Data: json.RawMessage(fmt.Sprintf(`{"x":%d}`, i+1)), Version: int64(i + 1)}
		if _, err := cache.Record("map", Mutation{MutationID: fmt.Sprint(i)}, before, after); err != nil {
			t.Fatal(err)
		}
	}
	entry := cache.entries["map"]
	if len(entry.updates) != 128 || len(entry.receipts) != 256 || cache.bytes != entry.bytes {
		t.Fatalf("unbounded buffer: %d/%d %d/%d", len(entry.updates), len(entry.receipts), cache.bytes, entry.bytes)
	}
	if _, exists, _ := cache.Receipt("map", "0", ""); exists {
		t.Fatal("old receipt retained")
	}
	cache.drop("map")
	if cache.bytes != 0 {
		t.Fatal("eviction leaked accounted bytes")
	}
}
