package store

import (
	"context"
	"errors"
	"testing"
)

// Uses the disposable PostgreSQL fixture from journals_integration_test.go.
func testJournalEditing(t *testing.T, s *Store) {
	ctx := context.Background()
	if _, err := s.pool.Exec(ctx, `INSERT INTO dndshare.session_participant VALUES (1,2,2)`); err != nil {
		t.Fatal(err)
	}
	permissions := func(journalID, userID int64, want JournalPermissions) {
		t.Helper()
		got, err := s.JournalPermissions(ctx, journalID, userID)
		if err != nil || got != want {
			t.Fatalf("permissions journal=%d user=%d: got %+v, want %+v, error=%v", journalID, userID, got, want, err)
		}
	}
	permissions(4, 1, JournalPermissions{true, true, true})
	permissions(4, 2, JournalPermissions{true, true, false})
	permissions(4, 99, JournalPermissions{})
	permissions(5, 1, JournalPermissions{}) // Deleted campaign.
	permissions(1, 1, JournalPermissions{true, true, false})
	if err := s.SetJournalPlayerEditing(ctx, 4, 2, false); !errors.Is(err, ErrNotFound) {
		t.Fatalf("player changed editing permissions: %v", err)
	}
	if err := s.SetJournalPlayerEditing(ctx, 4, 1, false); err != nil {
		t.Fatal(err)
	}
	permissions(4, 2, JournalPermissions{true, false, false})
	permissions(4, 1, JournalPermissions{true, true, true})
	journal, err := s.GetSessionJournal(ctx, 1)
	if err != nil || journal.PlayersCanEdit {
		t.Fatalf("editing setting was not persisted: %+v, %v", journal, err)
	}
	if err := s.UpdateJournalGraph(ctx, 4, 2, JournalGraphMutation{ExpectedRevision: journal.Graph.Revision, Links: []JournalLink{}}); !errors.Is(err, ErrJournalReadOnly) {
		t.Fatalf("read-only player modified graph: %v", err)
	}
	if err := s.SetJournalPlayerEditing(ctx, 4, 1, true); err != nil {
		t.Fatal(err)
	}
	permissions(4, 2, JournalPermissions{true, true, false})

	if err := s.UpdateJournalEntry(ctx, 1, 1, 1, JournalEntryMutation{Type: "battle", Title: "Changed"}); !errors.Is(err, ErrJournalEntryConflict) {
		t.Fatalf("changing an existing entry type accepted: %v", err)
	}
	current, err := s.GetCharacterJournal(ctx, 1)
	if err != nil {
		t.Fatal(err)
	}
	if err := s.UpdateJournalEntry(ctx, 1, 1, 1, JournalEntryMutation{Type: "event", Title: "Edited", ExpectedChangedAt: current.Sections[0].Entries[0].ChangedAt}); err != nil {
		t.Fatalf("same-type edit rejected: %v", err)
	}
}
