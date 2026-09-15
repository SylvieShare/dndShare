package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func testSessionInventory(t *testing.T, s *Store, pool *pgxpool.Pool) {
	ctx := context.Background()
	if _, _, err := s.SessionInventory(ctx, 1, 1); !errors.Is(err, ErrNotFound) {
		t.Fatalf("player read inventory: %v", err)
	}
	var counter int
	action := func() string { counter++; return fmt.Sprintf("10000000-0000-4000-8000-%012d", counter) }
	inventory := func() []SessionInventoryEntry {
		t.Helper()
		entries, _, err := s.SessionInventory(ctx, 1, 3)
		if err != nil {
			t.Fatal(err)
		}
		return entries
	}
	for _, source := range []string{"items", "weapon", "potions"} {
		t.Run(source, func(t *testing.T) {
			count := 3
			if source == "weapon" {
				count = 1
			}
			name := "Запас: " + source
			raw := json.RawMessage(fmt.Sprintf(`{"count":%d,"override":{"name":%q,"desc":"Описание"},"params":{"custom":7,"magic":{"remaining":2,"attuned":true,"use_cooldowns":{"test":3}}}}`, count, name))
			addID := action()
			if err := s.AddSessionInventory(ctx, 1, 1, source, name, action(), raw); !errors.Is(err, ErrNotFound) {
				t.Fatalf("player added item: %v", err)
			}
			for i := 0; i < 2; i++ {
				if err := s.AddSessionInventory(ctx, 1, 3, source, name, addID, raw); err != nil {
					t.Fatal(err)
				}
			}
			entries := inventory()
			if len(entries) != 1 {
				t.Fatalf("duplicate addition: %+v", entries)
			}
			if _, err := s.SendSessionInventory(ctx, 1, 3, 3, entries[0].ID, action()); !errors.Is(err, ErrNotFound) {
				t.Fatalf("foreign recipient: %v", err)
			}
			if _, err := s.SendSessionInventory(ctx, 1, 1, 2, entries[0].ID, action()); !errors.Is(err, ErrNotFound) {
				t.Fatalf("player sent inventory: %v", err)
			}
			sendID := action()
			offers := make(chan ItemTransfer, 2)
			errs := make(chan error, 2)
			var wg sync.WaitGroup
			for i := 0; i < 2; i++ {
				wg.Add(1)
				go func() {
					defer wg.Done()
					offer, err := s.SendSessionInventory(ctx, 1, 3, 2, entries[0].ID, sendID)
					offers <- offer
					errs <- err
				}()
			}
			wg.Wait()
			a, b := <-offers, <-offers
			if err := <-errs; err != nil {
				t.Fatal(err)
			}
			if err := <-errs; err != nil {
				t.Fatal(err)
			}
			if a.ID != b.ID || a.SenderCharID != 0 || a.AuthorUserID != 3 || a.RecipientUserID != 2 || len(inventory()) != 0 {
				t.Fatalf("reservation: %+v %+v", a, b)
			}
			visible, err := s.GetSessionEvents(ctx, 1, 2, a.EventID-1, 100)
			if err != nil || len(visible) != 1 || visible[0].RecipientUserID == nil || *visible[0].RecipientUserID != 2 || visible[0].AuthorUserID != 3 {
				t.Fatalf("inventory offer missing from recipient events: %+v %v", visible, err)
			}
			hidden, err := s.GetSessionEvents(ctx, 1, 1, a.EventID-1, 100)
			if err != nil || len(hidden) != 0 {
				t.Fatalf("unaddressed inventory offer exposed: %+v %v", hidden, err)
			}
			for i := 0; i < 2; i++ {
				if _, err := s.ResolveItemTransfer(ctx, 2, 2, a.ID, false); err != nil {
					t.Fatal(err)
				}
			}
			entries = inventory()
			if len(entries) != 1 {
				t.Fatal("refusal did not return exactly one entry")
			}
			offer, err := s.SendSessionInventory(ctx, 1, 3, 2, entries[0].ID, action())
			if err != nil {
				t.Fatal(err)
			}
			for i := 0; i < 2; i++ {
				if _, err = s.ResolveItemTransfer(ctx, 2, 2, offer.ID, true); err != nil {
					t.Fatal(err)
				}
			}
			var version int64
			var charRaw json.RawMessage
			if err = pool.QueryRow(ctx, `SELECT version,data FROM dndshare."char" WHERE id=2`).Scan(&version, &charRaw); err != nil {
				t.Fatal(err)
			}
			doc, err := decodeTransferDocument(charRaw)
			if err != nil {
				t.Fatal(err)
			}
			accepted, err := doc.take(source, fmt.Sprintf("transfer-%d", offer.ID))
			if err != nil {
				t.Fatal("item was not received", err)
			}
			params := accepted["params"].(map[string]any)
			magic := params["magic"].(map[string]any)
			if number(accepted["count"]) != count || number(params["custom"]) != 7 || number(magic["remaining"]) != 2 || magic["attuned"] != nil || magic["use_cooldowns"] == nil {
				t.Fatalf("parameters lost: %+v", accepted)
			}
			incoming, err := s.CreateItemTransfer(ctx, 2, 1, 2, 0, version, source, fmt.Sprintf("transfer-%d", offer.ID), action())
			if err != nil {
				t.Fatal(err)
			}
			if !incoming.AddressedToDM || incoming.RecipientUserID != 3 {
				t.Fatalf("wrong DM target: %+v", incoming)
			}
			if _, err = s.ResolveSessionApplication(ctx, 1, 1, incoming.EventID, true, ApplicationTarget{}); !errors.Is(err, ErrNotFound) {
				t.Fatalf("player approved DM offer: %v", err)
			}
			for i := 0; i < 2; i++ {
				if _, err = s.ApproveSessionTransfer(ctx, 3, 1, incoming.EventID); err != nil {
					t.Fatal(err)
				}
			}
			entries = inventory()
			if len(entries) != 1 {
				t.Fatal("DM acceptance did not store exactly one entry")
			}
			if err = s.DeleteSessionInventory(ctx, 1, 1, entries[0].ID); !errors.Is(err, ErrNotFound) {
				t.Fatalf("player deleted inventory: %v", err)
			}
			for i := 0; i < 2; i++ {
				if err = s.DeleteSessionInventory(ctx, 1, 3, entries[0].ID); err != nil {
					t.Fatal(err)
				}
			}
			if err = s.AddSessionInventory(ctx, 1, 3, source, name, addID, raw); err != nil {
				t.Fatal(err)
			}
			if len(inventory()) != 0 {
				t.Fatal("retry resurrected deleted/transferred entry")
			}
			_, pending, err := s.SessionInventory(ctx, 1, 3)
			if err != nil || len(pending) != 0 {
				t.Fatalf("pending transfers after resolution: %+v %v", pending, err)
			}
		})
	}
}
