package store

import (
	"context"
	"errors"
	"math"
	"reflect"
	"sync"
	"testing"
)

func TestJournalGraphValidation(t *testing.T) {
	nodes := []JournalNode{{ID: 1}, {ID: 2}, {ID: 3}, {ID: 4}, {ID: 5}}
	forkMerge := []JournalLink{{FromID: 1, ToID: 2}, {FromID: 1, ToID: 3}, {FromID: 2, ToID: 4}, {FromID: 3, ToID: 4}, {FromID: 4, ToID: 5}}
	if err := validateJournalGraph(nodes, forkMerge); err != nil {
		t.Fatal(err)
	}
	for _, links := range [][]JournalLink{
		{{FromID: 1, ToID: 1}}, {{FromID: 1, ToID: 99}}, {{FromID: 1, ToID: 2}, {FromID: 1, ToID: 2}},
		append(append([]JournalLink{}, forkMerge...), JournalLink{FromID: 5, ToID: 1}),
	} {
		if !errors.Is(validateJournalGraph(nodes, links), ErrJournalGraphInvalid) {
			t.Fatalf("accepted invalid links: %+v", links)
		}
	}
	for _, value := range []float64{math.NaN(), math.Inf(1), -1000001} {
		if validJournalPosition(JournalNode{PositionX: value}) {
			t.Fatalf("accepted position %v", value)
		}
	}
}

func testJournalGraph(t *testing.T, s *Store) {
	ctx := context.Background()
	journal, err := s.CreatePersonalJournal(ctx, 4, 2, "Graph")
	if err != nil {
		t.Fatal(err)
	}
	section, err := s.CreateJournalSection(ctx, journal.ID, "Разделение", "")
	if err != nil {
		t.Fatal(err)
	}
	read := func() Journal {
		t.Helper()
		j, err := s.GetJournalByUUID(ctx, journal.UUID)
		if err != nil {
			t.Fatal(err)
		}
		return j
	}
	create := func(section int64, parents []int64) int64 {
		t.Helper()
		revision := read().Graph.Revision
		id, err := s.CreateJournalEntry(ctx, journal.ID, section, 2, JournalEntryMutation{Type: "event", Title: "Момент", ParentIDs: parents, ExpectedGraphRevision: &revision})
		if err != nil {
			t.Fatal(err)
		}
		return id
	}
	root := create(section, []int64{})
	left, right := create(section, []int64{root}), create(section, []int64{root})
	merged := create(section, []int64{left, right})
	nextSection, err := s.CreateJournalSection(ctx, journal.ID, "Вместе", "")
	if err != nil {
		t.Fatal(err)
	}
	last := create(nextSection, []int64{merged})
	before := read()
	if len(before.Graph.Nodes) != 5 || len(before.Graph.Links) != 5 {
		t.Fatalf("lost fork/merge/cross-section: %+v", before.Graph)
	}
	if before.Graph.Nodes[1].PositionX == before.Graph.Nodes[2].PositionX {
		t.Fatal("branches overlap")
	}
	cycle := append(append([]JournalLink{}, before.Graph.Links...), JournalLink{FromID: last, ToID: root})
	if err := s.UpdateJournalGraph(ctx, journal.ID, 2, JournalGraphMutation{ExpectedRevision: before.Graph.Revision, Links: cycle}); !errors.Is(err, ErrJournalGraphInvalid) {
		t.Fatalf("cycle accepted: %v", err)
	}
	if !reflect.DeepEqual(before, read()) {
		t.Fatal("failed graph mutation changed data")
	}
	if err := s.UpdateJournalGraph(ctx, journal.ID, 2, JournalGraphMutation{ExpectedRevision: before.Graph.Revision, Links: before.Graph.Links, Positions: before.Graph.Nodes}); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(before, read()) {
		t.Fatal("saving an unchanged graph must not rewrite links or bump its revision")
	}

	// Two editors using the same version cannot overwrite each other's layout.
	var wg sync.WaitGroup
	results := make(chan error, 2)
	for i := range 2 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			results <- s.UpdateJournalGraph(ctx, journal.ID, 2, JournalGraphMutation{ExpectedRevision: before.Graph.Revision, Positions: []JournalNode{{ID: root, PositionX: float64(100 + i)}}})
		}()
	}
	wg.Wait()
	close(results)
	successes, conflicts := 0, 0
	for err := range results {
		if err == nil {
			successes++
		} else if errors.Is(err, ErrJournalGraphConflict) {
			conflicts++
		} else {
			t.Fatal(err)
		}
	}
	if successes != 1 || conflicts != 1 {
		t.Fatalf("expected one winner, got %d/%d", successes, conflicts)
	}
	moved := read()
	if !reflect.DeepEqual(before.Sections, moved.Sections) {
		t.Fatal("moving nodes rewrote event content or audit")
	}
	if err := s.UpdateJournalGraph(ctx, journal.ID, 2, JournalGraphMutation{ExpectedRevision: moved.Graph.Revision, Positions: []JournalNode{{ID: 1, PositionX: 400}}}); !errors.Is(err, ErrJournalGraphInvalid) {
		t.Fatalf("cross-journal move accepted: %v", err)
	}
	if _, err := s.CreateJournalEntry(ctx, journal.ID, section, 2, JournalEntryMutation{Type: "event", ParentIDs: []int64{1}}); !errors.Is(err, ErrJournalGraphInvalid) {
		t.Fatalf("foreign parent accepted: %v", err)
	}
	if !reflect.DeepEqual(moved, read()) {
		t.Fatal("failed entry creation must roll back its node and revision")
	}
	if err := s.DeleteJournalEntry(ctx, journal.ID, left); err != nil {
		t.Fatal(err)
	}
	after := read()
	if len(after.Graph.Nodes) != 4 || len(after.Graph.Links) != 3 {
		t.Fatalf("entry deletion did not remove incident links: %+v", after.Graph)
	}
	for _, link := range after.Graph.Links {
		if link.FromID == left || link.ToID == left {
			t.Fatal("dangling link")
		}
	}
	if err := s.DeleteJournalSection(ctx, journal.ID, nextSection); err != nil {
		t.Fatal(err)
	}
	if len(read().Graph.Links) != 2 {
		t.Fatal("cross-section links must cascade when removing their target section")
	}
}
