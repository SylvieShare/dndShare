package store

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"testing"
)

func testJournalCreationReceipts(t *testing.T, s *Store) {
	ctx := context.Background()
	journal, err := s.CreatePersonalJournal(ctx, 3, 1, "Повтор запросов")
	if err != nil {
		t.Fatal(err)
	}
	sectionKey := JournalCreationIdentity{UserID: 1, ClientActionID: "20000000-0000-4000-8000-000000000501"}
	sectionID, err := s.CreateJournalSection(ctx, journal.ID, "Новый раздел", "2026-10-28", sectionKey)
	if err != nil {
		t.Fatal(err)
	}
	again, err := s.CreateJournalSection(ctx, journal.ID, "Новый раздел", "2026-10-28", sectionKey)
	if err != nil || again != sectionID {
		t.Fatalf("section replay: %d != %d: %v", again, sectionID, err)
	}
	if _, err = s.CreateJournalSection(ctx, journal.ID, "Другое имя", "2026-10-28", sectionKey); !errors.Is(err, ErrJournalCreationIdentity) {
		t.Fatalf("identity reused: %v", err)
	}
	loaded, err := s.GetJournalByUUID(ctx, journal.UUID)
	if err != nil {
		t.Fatal(err)
	}
	revision := loaded.Graph.Revision
	mutation := JournalEntryMutation{ClientActionID: "20000000-0000-4000-8000-000000000502", Type: "quest", Title: "Проверка", Description: "<p>Содержимое</p>", Payload: json.RawMessage(`{"quest":{"reward":"Награда","objectives":[]}}`), ExpectedGraphRevision: &revision}
	var wg sync.WaitGroup
	var lock sync.Mutex
	var ids []int64
	for range 8 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			id, err := s.CreateJournalEntry(ctx, journal.ID, sectionID, 1, mutation)
			if err != nil {
				t.Errorf("entry retry: %v", err)
				return
			}
			lock.Lock()
			ids = append(ids, id)
			lock.Unlock()
		}()
	}
	wg.Wait()
	if len(ids) != 8 {
		t.Fatalf("successful acknowledgements: %d", len(ids))
	}
	for _, id := range ids {
		if id != ids[0] {
			t.Fatalf("duplicate entry: %v", ids)
		}
	}
	loaded, err = s.GetJournalByUUID(ctx, journal.UUID)
	if err != nil {
		t.Fatal(err)
	}
	count := 0
	for _, section := range loaded.Sections {
		if section.ID == sectionID {
			count = len(section.Entries)
		}
	}
	if count != 1 {
		t.Fatalf("duplicate journal entries: %d", count)
	}
	mutation.Title = "Подменённая запись"
	if _, err = s.CreateJournalEntry(ctx, journal.ID, sectionID, 1, mutation); !errors.Is(err, ErrJournalCreationIdentity) {
		t.Fatalf("entry request changed under same key: %v", err)
	}
}
