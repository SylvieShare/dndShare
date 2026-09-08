package store

import (
	"context"
	"errors"
	"testing"
)

func testJournalEntryAudit(t *testing.T, s *Store) {
	ctx := context.Background()
	sectionID, err := s.CreateJournalSection(ctx, 4, "Audit", "")
	if err != nil {
		t.Fatal(err)
	}
	id, err := s.CreateJournalEntry(ctx, 4, sectionID, 1, JournalEntryMutation{Type: "event", Title: "First"})
	if err != nil {
		t.Fatal(err)
	}
	read := func() JournalEntry {
		t.Helper()
		j, err := s.GetSessionJournal(ctx, 1)
		if err != nil {
			t.Fatal(err)
		}
		return j.Sections[0].Entries[0]
	}
	created := read()
	if created.CreatedAt.IsZero() || !created.CreatedAt.Equal(created.ChangedAt) ||
		created.AuthorName == nil || *created.AuthorName != "Мастер" ||
		created.ChangedByUserID == nil || *created.ChangedByUserID != 1 {
		t.Fatalf("incorrect creation metadata: %+v", created)
	}
	if err := s.UpdateJournalEntry(ctx, 4, id, 2, JournalEntryMutation{Type: "event", Title: "Edited", ExpectedChangedAt: created.ChangedAt}); err != nil {
		t.Fatal(err)
	}
	edited := read()
	if err := s.UpdateJournalEntry(ctx, 4, id, 1, JournalEntryMutation{Type: "event", Title: "Stale overwrite", ExpectedChangedAt: created.ChangedAt}); !errors.Is(err, ErrJournalEntryConflict) {
		t.Fatalf("stale edit must be rejected: %v", err)
	}
	if unchanged := read(); unchanged.Title != "Edited" || !unchanged.ChangedAt.Equal(edited.ChangedAt) {
		t.Fatalf("stale edit modified stored data: %+v", unchanged)
	}
	if !edited.CreatedAt.Equal(created.CreatedAt) || !edited.ChangedAt.After(created.ChangedAt) ||
		edited.AuthorName == nil || *edited.AuthorName != "Мастер" ||
		edited.ChangedByName == nil || *edited.ChangedByName != "Игрок" ||
		edited.ChangedByUserID == nil || *edited.ChangedByUserID != 2 {
		t.Fatalf("incorrect edit metadata: %+v", edited)
	}
	otherID, err := s.CreateJournalEntry(ctx, 4, sectionID, 2, JournalEntryMutation{Type: "dialog"})
	if err != nil {
		t.Fatal(err)
	}
	graphBefore, err := s.GetSessionJournal(ctx, 1)
	if err != nil {
		t.Fatal(err)
	}
	if err := s.UpdateJournalGraph(ctx, 4, 2, JournalGraphMutation{ExpectedRevision: graphBefore.Graph.Revision, Positions: []JournalNode{{ID: otherID, PositionX: 100}, {ID: id, PositionY: 200}}}); err != nil {
		t.Fatal(err)
	}
	j, err := s.GetSessionJournal(ctx, 1)
	if err != nil {
		t.Fatal(err)
	}
	reordered := j.Sections[0].Entries[0]
	if reordered.ID != id || !reordered.ChangedAt.Equal(edited.ChangedAt) || *reordered.ChangedByUserID != 2 {
		t.Fatalf("reordering must not rewrite content edit history: %+v", reordered)
	}
	legacy, err := s.GetCharacterJournal(ctx, 25)
	if err != nil {
		t.Fatal(err)
	}
	if legacy.Sections[0].Entries[0].ChangedByUserID != nil {
		t.Fatal("migration must not fabricate a historical editor")
	}
}
