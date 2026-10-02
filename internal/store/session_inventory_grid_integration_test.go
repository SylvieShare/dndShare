package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"testing"
)

func testSessionInventoryGrid(t *testing.T, s *Store) {
	ctx := context.Background()
	raw := json.RawMessage(`{"count":2,"params":{"custom":7},"override":{"name":"Запас"}}`)
	for i := 0; i < 4; i++ {
		if err := s.AddSessionInventory(ctx, 1, 3, "items", "Запас", fmt.Sprintf("20000000-0000-4000-8000-%012d", i), raw); err != nil {
			t.Fatal(err)
		}
	}
	read := func() []SessionInventoryEntry {
		t.Helper()
		entries, _, err := s.SessionInventory(ctx, 1, 3)
		if err != nil {
			t.Fatal(err)
		}
		return entries
	}
	entries := read()
	if len(entries) != 4 {
		t.Fatalf("expected four entries: %+v", entries)
	}
	a, b := entries[0].ID, entries[1].ID
	if err := s.MoveSessionInventory(ctx, 1, 1, a, 0, 1, b); !errors.Is(err, ErrNotFound) {
		t.Fatalf("player moved inventory: %v", err)
	}
	for i := 0; i < 2; i++ {
		if err := s.MoveSessionInventory(ctx, 1, 3, a, 0, 1, b); err != nil {
			t.Fatal(err)
		}
	}
	entries = read()
	if entries[0].ID != b || entries[1].ID != a {
		t.Fatalf("retry reversed swap: %+v", entries)
	}
	if err := s.MoveSessionInventory(ctx, 1, 3, a, 0, 2, entries[2].ID); !errors.Is(err, ErrItemTransferConflict) {
		t.Fatalf("stale source accepted: %v", err)
	}
	if err := s.MoveSessionInventory(ctx, 1, 3, a, 1, 2, ""); !errors.Is(err, ErrItemTransferConflict) {
		t.Fatalf("stale target accepted: %v", err)
	}
	if err := s.MoveSessionInventory(ctx, 1, 3, a, 1, 8, ""); !errors.Is(err, ErrApplication) {
		t.Fatalf("outside grid accepted: %v", err)
	}
	if err := s.MoveSessionInventory(ctx, 1, 3, a, 1, 7, ""); err != nil {
		t.Fatal(err)
	}
	entries = read()
	if entries[3].ID != a || entries[3].Slot != 7 {
		t.Fatalf("free slot lost: %+v", entries)
	}
	var wg sync.WaitGroup
	errs := make(chan error, 2)
	for i := 4; i < 6; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			errs <- s.AddSessionInventory(ctx, 1, 3, "items", "Запас", fmt.Sprintf("20000000-0000-4000-8000-%012d", i), raw)
		}(i)
	}
	wg.Wait()
	for i := 0; i < 2; i++ {
		if err := <-errs; err != nil {
			t.Fatal(err)
		}
	}
	entries = read()
	slots := map[int]bool{}
	for _, entry := range entries {
		if slots[entry.Slot] {
			t.Fatalf("duplicate slot: %+v", entries)
		}
		slots[entry.Slot] = true
		var data map[string]any
		_ = json.Unmarshal(entry.Entry, &data)
		if number(data["count"]) != 2 || number(data["params"].(map[string]any)["custom"]) != 7 {
			t.Fatalf("instance changed: %+v", data)
		}
	}
	if !slots[1] || !slots[4] || !slots[7] {
		t.Fatalf("additions failed to fill holes: %+v", slots)
	}
}
