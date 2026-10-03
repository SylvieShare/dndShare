package store

import (
	"context"
	"errors"
	"testing"
)

func createCampaignSectionTest(t *testing.T, s *Store, sessionID int64, name string) int64 {
	t.Helper()
	ctx := context.Background()
	rows, err := s.ListSessionOccurrences(ctx, sessionID)
	if err != nil {
		t.Fatal(err)
	}
	number := 1
	for _, row := range rows {
		if row.Number >= number {
			number = row.Number + 1
		}
	}
	id, err := s.CreateSessionOccurrence(ctx, sessionID, SessionOccurrenceMutation{Number: number, Name: name, Date: "2026-10-03"})
	if err != nil {
		t.Fatal(err)
	}
	rows, err = s.ListSessionOccurrences(ctx, sessionID)
	if err != nil {
		t.Fatal(err)
	}
	for _, row := range rows {
		if row.ID == id {
			return row.SectionID
		}
	}
	t.Fatal("new meeting has no diary section")
	return 0
}

func testSessionOccurrences(t *testing.T, s *Store) {
	ctx := context.Background()
	rows, err := s.ListSessionOccurrences(ctx, 1)
	if err != nil || len(rows) != 4 {
		t.Fatalf("migration: %+v, %v", rows, err)
	}
	byNumber := map[int]SessionOccurrence{}
	for _, row := range rows {
		byNumber[row.Number] = row
		if row.EntryCount != 1 {
			t.Fatal("lost migrated entry")
		}
	}
	if *byNumber[1].Date != "2026-09-01" || *byNumber[3].Date != "2026-10-03" || byNumber[2].Date != nil || byNumber[4].Date != nil {
		t.Fatalf("legacy dates: %+v", byNumber)
	}
	j, err := s.GetSessionJournal(ctx, 1)
	if err != nil || len(j.Sections) != 4 || j.Sections[1].Title != "Хаммер" || *j.Sections[1].OccurrenceID != byNumber[2].ID {
		t.Fatalf("diary binding: %+v,%v", j, err)
	}
	if _, err := s.CreateJournalSection(ctx, j.ID, "Bypass", ""); !errors.Is(err, ErrJournalSectionManaged) {
		t.Fatalf("unbound section accepted: %v", err)
	}
	if err := s.DeleteJournalSection(ctx, j.ID, byNumber[1].SectionID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("linked section deletion accepted: %v", err)
	}
	if err := s.UpdateJournalSection(ctx, j.ID, byNumber[1].SectionID, "Bypass", ""); !errors.Is(err, ErrNotFound) {
		t.Fatalf("duplicate metadata accepted: %v", err)
	}
	id, err := s.CreateSessionOccurrence(ctx, 1, SessionOccurrenceMutation{Number: 10, Name: "Продолжение", Date: "2026-10-10"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = s.CreateSessionOccurrence(ctx, 1, SessionOccurrenceMutation{Number: 10, Name: "Дубль", Date: "2026-11-10"}); !errors.Is(err, ErrOccurrenceNumber) {
		t.Fatalf("duplicate number: %v", err)
	}
	rows, err = s.ListSessionOccurrences(ctx, 1)
	if err != nil {
		t.Fatal(err)
	}
	var meeting SessionOccurrence
	for _, row := range rows {
		if row.ID == id {
			meeting = row
		}
	}
	entryID, err := s.CreateJournalEntry(ctx, j.ID, meeting.SectionID, 1, JournalEntryMutation{Type: "event", Title: "Запись"})
	if err != nil {
		t.Fatal(err)
	}
	m := SessionOccurrenceMutation{Number: 11, Name: "Перенесена", Date: "2026-11-11", ExpectedChangedAt: meeting.ChangedAt}
	duplicate := m
	duplicate.Number = 1
	if err = s.UpdateSessionOccurrence(ctx, 1, id, duplicate); !errors.Is(err, ErrOccurrenceNumber) {
		t.Fatalf("duplicate number on edit: %v", err)
	}
	if err = s.UpdateSessionOccurrence(ctx, 2, id, m); !errors.Is(err, ErrNotFound) {
		t.Fatalf("cross-campaign update: %v", err)
	}
	if err = s.UpdateSessionOccurrence(ctx, 1, id, m); err != nil {
		t.Fatal(err)
	}
	if err = s.UpdateSessionOccurrence(ctx, 1, id, m); !errors.Is(err, ErrOccurrenceConflict) {
		t.Fatalf("stale update: %v", err)
	}
	j, err = s.GetSessionJournal(ctx, 1)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, section := range j.Sections {
		if section.ID == meeting.SectionID {
			found = true
			if section.Title != "Перенесена" || section.Date != "2026-11-11" || *section.Number != 11 || section.Entries[0].ID != entryID {
				t.Fatalf("meeting and diary diverged: %+v", section)
			}
		}
	}
	if !found {
		t.Fatal("missing bound diary")
	}
	if err = s.DeleteSessionOccurrence(ctx, 2, id); !errors.Is(err, ErrNotFound) {
		t.Fatalf("cross-campaign delete: %v", err)
	}
	if err = s.DeleteSessionOccurrence(ctx, 1, id); err != nil {
		t.Fatal(err)
	}
	var count int
	if err = s.pool.QueryRow(ctx, `SELECT count(*) FROM dndshare.journal_entry WHERE id=$1`, entryID).Scan(&count); err != nil || count != 0 {
		t.Fatal("meeting delete left its diary entry")
	}
	rows, err = s.ListSessionOccurrences(ctx, 1)
	if err != nil || len(rows) != 4 {
		t.Fatalf("meeting delete affected neighbors: %+v,%v", rows, err)
	}
}
