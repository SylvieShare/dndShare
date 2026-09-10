package store

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
)

func testJournalQuest(t *testing.T, s *Store) {
	ctx := context.Background()
	journal, err := s.CreateSessionJournal(ctx, 1, "Кампания")
	if err != nil {
		t.Fatal(err)
	}
	sectionID, err := s.CreateJournalSection(ctx, journal.ID, "Задания", "")
	if err != nil {
		t.Fatal(err)
	}
	payload := json.RawMessage(`{"quest":{"reward":"Карта","objectives":[{"id":"key","text":"Найти ключ","done":false}]}}`)
	id, err := s.CreateJournalEntry(ctx, journal.ID, sectionID, 1, JournalEntryMutation{Type: "quest", Title: "Маяк", Payload: payload})
	if err != nil {
		t.Fatal(err)
	}
	read := func() JournalEntry {
		t.Helper()
		loaded, err := s.GetJournalByUUID(ctx, journal.UUID)
		if err != nil {
			t.Fatal(err)
		}
		for _, section := range loaded.Sections {
			for _, entry := range section.Entries {
				if entry.ID == id {
					return entry
				}
			}
		}
		t.Fatal("quest entry missing")
		return JournalEntry{}
	}
	created := read()
	if created.Type != "quest" {
		t.Fatal("quest type lost")
	}
	completed := json.RawMessage(`{"quest":{"reward":"Карта","objectives":[{"id":"key","text":"Найти ключ","done":true}]}}`)
	mutation := JournalEntryMutation{Type: "quest", Title: "Маяк", Payload: completed, ExpectedChangedAt: created.ChangedAt}
	if err := s.UpdateJournalEntry(ctx, journal.ID, id, 2, mutation); err != nil {
		t.Fatal(err)
	}
	if err := s.UpdateJournalEntry(ctx, journal.ID, id, 1, mutation); !errors.Is(err, ErrJournalEntryConflict) {
		t.Fatalf("stale checklist update: %v", err)
	}
	entry := read()
	var value struct {
		Quest struct {
			Reward     string
			Objectives []struct{ Done bool }
		}
	}
	if err := json.Unmarshal(entry.Payload, &value); err != nil {
		t.Fatal(err)
	}
	if value.Quest.Reward != "Карта" || len(value.Quest.Objectives) != 1 || !value.Quest.Objectives[0].Done {
		t.Fatalf("checklist lost: %s", entry.Payload)
	}
	if entry.ChangedByName == nil || *entry.ChangedByName != "Игрок" {
		t.Fatal("checkbox edit author lost")
	}
}
