package store

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"
)

func testPotionUseRequests(t *testing.T, s *Store, exec func(string), current func(int64) transferCharacter) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	exec(`UPDATE dndshare."char" SET data=jsonb_set(data,'{values,potions}',(data #> '{values,potions}') || '[{"uid":"use-potion","count":2,"override":{"name":"Зелье применения"},"params":{"custom":7}}]'::jsonb) WHERE id=1`)
	count := func() float64 {
		doc, _ := decodeTransferDocument(current(1).Data)
		for _, raw := range doc.values()["potions"].([]any) {
			entry := raw.(map[string]any)
			if entry["uid"] == "use-potion" {
				return entry["count"].(float64)
			}
		}
		return 0
	}
	for n, accept := range []bool{false, true, true} {
		before := count()
		sender, recipient := current(1), current(2)
		action := fmt.Sprintf("00000000-0000-4000-8000-%012d", 100+n)
		if _, err := s.CreatePotionUse(ctx, 3, 1, 1, 2, sender.Version, "use-potion", action); !errors.Is(err, ErrNotFound) {
			t.Fatalf("non-owner: %v", err)
		}
		if _, err := s.CreatePotionUse(ctx, 1, 1, 1, 3, sender.Version, "use-potion", action); !errors.Is(err, ErrNotFound) {
			t.Fatalf("outsider target: %v", err)
		}
		if _, err := s.CreatePotionUse(ctx, 1, 1, 1, 2, sender.Version-1, "use-potion", action); !errors.Is(err, ErrCharacterVersion) {
			t.Fatalf("stale version: %v", err)
		}
		offer, err := s.CreatePotionUse(ctx, 1, 1, 1, 2, sender.Version, "use-potion", action)
		if err != nil || offer.Purpose != "use" || count() != before-1 {
			t.Fatalf("reservation: %+v %v count=%v", offer, err, count())
		}
		retry, err := s.CreatePotionUse(ctx, 1, 1, 1, 2, sender.Version, "use-potion", action)
		if err != nil || retry.ID != offer.ID || count() != before-1 {
			t.Fatalf("retry spent again: %+v %v", retry, err)
		}
		if _, err := s.CreateItemTransfer(ctx, 1, 1, 1, 2, sender.Version, "potions", "use-potion", action); !errors.Is(err, ErrItemTransferConflict) {
			t.Fatalf("purpose mismatch: %v", err)
		}
		if _, err := s.ResolveItemTransfer(ctx, 1, 1, offer.ID, true); !errors.Is(err, ErrNotFound) {
			t.Fatalf("sender accepted own use: %v", err)
		}
		var wg sync.WaitGroup
		errs := make(chan error, 3)
		for i := 0; i < 3; i++ {
			wg.Add(1)
			go func(i int) {
				defer wg.Done()
				var err error
				if i == 0 {
					_, err = s.CreatePotionUse(ctx, 1, 1, 1, 2, sender.Version, "use-potion", action)
				} else if i == 1 && n == 2 {
					_, err = s.ApproveSessionTransfer(ctx, 3, 1, offer.EventID)
				} else if i == 2 && !accept {
					_, err = s.ResolveItemTransfer(ctx, 1, 1, offer.ID, false)
				} else {
					_, err = s.ResolveItemTransfer(ctx, 2, 2, offer.ID, accept)
				}
				errs <- err
			}(i)
		}
		wg.Wait()
		close(errs)
		for err := range errs {
			if err != nil {
				t.Fatal(err)
			}
		}
		want := before
		if accept {
			want--
		}
		if count() != want {
			t.Fatalf("wrong resolved stock: %v != %v", count(), want)
		}
		if string(current(2).Data) != string(recipient.Data) {
			t.Fatal("consumed potion was transferred into the target inventory")
		}
		if _, err := s.ResolveItemTransfer(ctx, 2, 2, offer.ID, !accept); !errors.Is(err, ErrItemTransferConflict) {
			t.Fatalf("resolved request changed: %v", err)
		}
	}
	if _, err := s.CreatePotionUse(ctx, 1, 1, 1, 2, current(1).Version, "use-potion", "00000000-0000-4000-8000-000000000199"); !errors.Is(err, ErrItemTransferConflict) {
		t.Fatalf("spent potion reused: %v", err)
	}
}
