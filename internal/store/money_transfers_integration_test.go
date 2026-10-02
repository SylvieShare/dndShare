package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"testing"
)

func testMoneyTransfersPostgres(t *testing.T, s *Store) {
	ctx := context.Background()
	exec := func(sql string) {
		t.Helper()
		if _, err := s.pool.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	exec(`CREATE TABLE dndshare.suggest(type_id bigint,id bigint,user_id bigint,value text,PRIMARY KEY(type_id,id));
 INSERT INTO dndshare.suggest VALUES(17,901,NULL,'Золотые'),(17,902,10,'Личные'),(18,903,NULL,'Не валюта');
 INSERT INTO dndshare.users VALUES(10,'Money sender'),(11,'Money recipient'),(12,'Money outsider');
 INSERT INTO dndshare."session"(id,owner_user_id) VALUES(901,3),(902,3);
 INSERT INTO dndshare."char"(id,user_id,data) VALUES
 (501,10,'{"values":{"name":"Отправитель","money":{"amounts":{"901":100,"902":50},"order":[902,901]}}}'),
 (502,11,'{"values":{"name":"Получатель","hp":{"current":10}}}'),
 (503,12,'{"values":{"name":"Посторонний"}}');
 INSERT INTO dndshare.session_participant VALUES(901,501,10),(901,502,11),(902,503,12);`)
	key := 5000
	nextKey := func() string { key++; return fmt.Sprintf("00000000-0000-4000-8000-%012d", key) }
	balance := func(id int64) (int64, int64) {
		t.Helper()
		var amount, version int64
		if err := s.pool.QueryRow(ctx, `SELECT (data#>>'{values,money,amounts,901}')::bigint,version FROM dndshare."char" WHERE id=$1`, id).Scan(&amount, &version); err != nil {
			t.Fatal(err)
		}
		return amount, version
	}
	action := nextKey()
	event, err := s.TransferCharacterMoney(ctx, 10, 901, 501, 502, 1, 901, 25, action)
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct{ id, amount int64 }{{501, 75}, {502, 25}} {
		got, version := balance(tc.id)
		if got != tc.amount || version != 2 {
			t.Fatalf("wallet %d: %d version %d", tc.id, got, version)
		}
	}
	if event.RecipientUserID == nil || *event.RecipientUserID != 11 {
		t.Fatal("recipient projection missing")
	}
	if strings.Contains(string(event.ActorData), "money") || strings.Contains(string(event.ActorData), "amounts") {
		t.Fatal("journal leaked the sender's wallet")
	}
	for _, reader := range []int64{10, 11, 3, 12} {
		page, err := s.GetSessionEvents(ctx, 901, reader, event.ID-1, 100)
		expected := 1
		if reader == 12 {
			expected = 0
		}
		if err != nil || len(page) != expected {
			t.Fatalf("audience %d: %d %v", reader, len(page), err)
		}
	}
	retry, err := s.TransferCharacterMoney(ctx, 10, 901, 501, 502, 1, 901, 25, action)
	if err != nil || retry.ID != event.ID {
		t.Fatalf("retry: %v %v", retry, err)
	}
	if got, version := balance(501); got != 75 || version != 2 {
		t.Fatal("retry charged twice")
	}
	for _, tc := range []struct {
		name                                           string
		user, sender, recipient, version, coin, amount int64
		action                                         string
		want                                           error
	}{
		{"forged owner", 12, 501, 502, 2, 901, 1, nextKey(), ErrNotFound},
		{"DM cannot spend", 3, 501, 502, 2, 901, 1, nextKey(), ErrNotFound},
		{"outside session", 10, 501, 503, 2, 901, 1, nextKey(), ErrNotFound},
		{"self", 10, 501, 501, 2, 901, 1, nextKey(), ErrNotFound},
		{"stale sheet", 10, 501, 502, 1, 901, 1, nextKey(), ErrCharacterVersion},
		{"overspend", 10, 501, 502, 2, 901, 76, nextKey(), ErrMoneyTransfer},
		{"wrong type", 10, 501, 502, 2, 903, 1, nextKey(), ErrMoneyTransfer},
		{"private currency", 10, 501, 502, 2, 902, 1, nextKey(), ErrMoneyTransfer},
		{"unknown currency", 10, 501, 502, 2, 999, 1, nextKey(), ErrMoneyTransfer},
		{"changed retry", 10, 501, 502, 2, 901, 1, action, ErrMoneyTransferConflict},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := s.TransferCharacterMoney(ctx, tc.user, 901, tc.sender, tc.recipient, tc.version, tc.coin, tc.amount, tc.action)
			if !errors.Is(err, tc.want) {
				t.Fatalf("expected %v, got %v", tc.want, err)
			}
			if got, version := balance(501); got != 75 || version != 2 {
				t.Fatal("rejected transfer changed sender")
			}
			if got, version := balance(502); got != 25 || version != 2 {
				t.Fatal("rejected transfer changed recipient")
			}
		})
	}
	// Same request in two tabs must produce one debit and one journal record.
	action = nextKey()
	var wg sync.WaitGroup
	results := make(chan SessionEvent, 2)
	errorsCh := make(chan error, 2)
	for range 2 {
		wg.Go(func() {
			e, err := s.TransferCharacterMoney(ctx, 10, 901, 501, 502, 2, 901, 5, action)
			results <- e
			errorsCh <- err
		})
	}
	wg.Wait()
	a, b := <-results, <-results
	if a.ID != b.ID || <-errorsCh != nil || <-errorsCh != nil {
		t.Fatal("concurrent duplicate transfer diverged")
	}
	if got, version := balance(501); got != 70 || version != 3 {
		t.Fatal("concurrent retry charged twice")
	}
	// Opposite transfers use deterministic locks and preserve the total.
	for _, tc := range [][3]int64{{10, 501, 502}, {11, 502, 501}} {
		user, sender, recipient := tc[0], tc[1], tc[2]
		action := nextKey()
		wg.Go(func() {
			_, err := s.TransferCharacterMoney(ctx, user, 901, sender, recipient, 3, 901, 1, action)
			errorsCh <- err
		})
	}
	wg.Wait()
	// The first transfer increments both versions; the second must detect it.
	e1, e2 := <-errorsCh, <-errorsCh
	if !((e1 == nil && errors.Is(e2, ErrCharacterVersion)) || (e2 == nil && errors.Is(e1, ErrCharacterVersion))) {
		t.Fatalf("opposite requests: %v %v", e1, e2)
	}
	from, _ := balance(501)
	to, _ := balance(502)
	if from+to != 100 {
		t.Fatal("money total changed")
	}
}
