package store

import (
	"context"
	"errors"
	"reflect"
	"slices"
	"sync"
	"testing"
)

func testJournalTimelineOrder(t *testing.T, s *Store) {
	ctx := context.Background()
	j, err := s.CreatePersonalJournal(ctx, 4, 2, "Лента")
	if err != nil {
		t.Fatal(err)
	}
	sectionID, err := s.CreateJournalSection(ctx, j.ID, "Порядок", "")
	if err != nil {
		t.Fatal(err)
	}
	ids := []int64{}
	for range 3 {
		id, err := s.CreateJournalEntry(ctx, j.ID, sectionID, 2, JournalEntryMutation{Type: "event", Title: "Запись"})
		if err != nil {
			t.Fatal(err)
		}
		ids = append(ids, id)
	}
	read := func() Journal {
		t.Helper()
		result, err := s.GetJournalByUUID(ctx, j.UUID)
		if err != nil {
			t.Fatal(err)
		}
		return result
	}
	order := func(journal Journal) []int64 {
		for _, section := range journal.Sections {
			if section.ID == sectionID {
				result := []int64{}
				for _, entry := range section.Entries {
					result = append(result, entry.ID)
				}
				return result
			}
		}
		t.Fatal("missing section")
		return nil
	}
	before := read()
	wanted := []int64{ids[2], ids[0], ids[1]}
	if err := s.ReorderJournalEntries(ctx, j.ID, sectionID, 1, wanted, ids); !errors.Is(err, ErrJournalReadOnly) {
		t.Fatalf("foreign user: %v", err)
	}
	for _, invalid := range [][]int64{{ids[0]}, {ids[0], ids[0], ids[2]}, {ids[0], ids[1], -1}} {
		if err := s.ReorderJournalEntries(ctx, j.ID, sectionID, 2, invalid, ids); !errors.Is(err, ErrJournalOrderConflict) {
			t.Fatalf("invalid order: %v", err)
		}
	}
	if err := s.ReorderJournalEntries(ctx, j.ID, sectionID, 2, wanted, ids); err != nil {
		t.Fatal(err)
	}
	after := read()
	if !slices.Equal(order(after), wanted) {
		t.Fatal("order not saved")
	}
	if !reflect.DeepEqual(before.Graph, after.Graph) {
		t.Fatal("timeline reorder changed stored graph")
	}
	original := map[int64]JournalEntry{}
	for _, section := range before.Sections {
		for _, entry := range section.Entries {
			original[entry.ID] = entry
		}
	}
	for _, section := range after.Sections {
		for _, entry := range section.Entries {
			entry.Position = original[entry.ID].Position
			if !reflect.DeepEqual(entry, original[entry.ID]) {
				t.Fatal("reordering changed contents or audit")
			}
		}
	}
	if err := s.ReorderJournalEntries(ctx, j.ID, sectionID, 2, ids, ids); !errors.Is(err, ErrJournalOrderConflict) {
		t.Fatalf("stale order: %v", err)
	}
	var wg sync.WaitGroup
	results := make(chan error, 2)
	for _, next := range [][]int64{ids, {ids[1], ids[2], ids[0]}} {
		wg.Add(1)
		go func() { defer wg.Done(); results <- s.ReorderJournalEntries(ctx, j.ID, sectionID, 2, next, wanted) }()
	}
	wg.Wait()
	close(results)
	won, conflicted := 0, 0
	for err := range results {
		if err == nil {
			won++
		} else if errors.Is(err, ErrJournalOrderConflict) {
			conflicted++
		} else {
			t.Fatal(err)
		}
	}
	if won != 1 || conflicted != 1 {
		t.Fatalf("concurrent moves: %d accepted, %d conflicts", won, conflicted)
	}
}
