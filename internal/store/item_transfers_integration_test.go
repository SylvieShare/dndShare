package store

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"strings"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestItemTransfersPostgres(t *testing.T) {
	dsn := os.Getenv("DNDSHARE_TRANSFER_TEST_DSN")
	if dsn == "" {
		t.Skip("set DNDSHARE_TRANSFER_TEST_DSN to a disposable local dndshare_test_* database")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Host != "127.0.0.1" || !strings.HasPrefix(cfg.ConnConfig.Database, "dndshare_test_") {
		t.Fatal("requires disposable local database")
	}
	cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	ctx := context.Background()
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	exec := func(sql string) {
		t.Helper()
		if _, err := pool.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	exec(`CREATE SCHEMA dndshare;
 CREATE TABLE dndshare.users(id bigint PRIMARY KEY,login text);
 CREATE TABLE dndshare.storage_image(id bigint PRIMARY KEY,url text,deleted bool DEFAULT false);
 CREATE TABLE dndshare.svg_storage(id bigint PRIMARY KEY,data text);
 CREATE TABLE dndshare.item(id bigint PRIMARY KEY,name text,icon_image_id bigint,cover_image_id bigint,icon_svg_id bigint);
 CREATE TABLE dndshare."session"(id bigint PRIMARY KEY,uuid uuid DEFAULT gen_random_uuid(),owner_user_id bigint,deleted bool DEFAULT false);
 CREATE TABLE dndshare."char"(id bigint PRIMARY KEY,uuid uuid DEFAULT gen_random_uuid(),user_id bigint,template_id bigint,icon_image_id bigint,
 data jsonb DEFAULT '{"values":{}}',version bigint DEFAULT 1,changed_at timestamptz DEFAULT now(),deleted bool DEFAULT false);
 CREATE TABLE dndshare.session_participant(session_id bigint,char_id bigint PRIMARY KEY,user_id bigint);
 CREATE TABLE dndshare.session_event(id bigserial PRIMARY KEY,session_id bigint,author_user_id bigint,actor_char_id bigint,actor_item_id bigint,
 actor_name text,event_type text,action text,data jsonb,visibility text,created_at timestamptz DEFAULT now(),deleted bool DEFAULT false,client_action_id uuid);
 CREATE UNIQUE INDEX event_action ON dndshare.session_event(session_id,client_action_id) WHERE client_action_id IS NOT NULL;
 INSERT INTO dndshare.users VALUES(1,'Sender'),(2,'Recipient'),(3,'Outsider');
 INSERT INTO dndshare.item(id,name) VALUES(30,'Посох');
 INSERT INTO dndshare."session"(id,owner_user_id) VALUES(1,3),(2,3);
 INSERT INTO dndshare."char"(id,user_id,data) VALUES
 (1,1,'{"values":{"name":"Лиора","items":{"equipped":[{"uid":"staff","item_id":30,"count":1,"params":{"magic":{"attuned":true,"remaining":2,"bonus_transfer":2,"use_cooldowns":{"wish":3}}}}]},"potions":[{"uid":"potion","item_id":null,"count":3,"override":{"name":"Зелье","desc":"Особое"},"params":{"custom":7}}]}}'),
 (2,2,'{"values":{"name":"Торин","hp":{"current":10}}}'),(3,3,'{"values":{"name":"Чужой"}}');
 INSERT INTO dndshare.session_participant VALUES(1,1,1),(1,2,2),(2,3,3);`)
	defer exec(`DROP SCHEMA dndshare CASCADE`)
	exec(schemaItemTransfersSQL)
	s := &Store{pool: pool}
	current := func(id int64) transferCharacter {
		t.Helper()
		var c transferCharacter
		if err := pool.QueryRow(ctx, `SELECT id,user_id,version,data FROM dndshare."char" WHERE id=$1`, id).Scan(&c.ID, &c.UserID, &c.Version, &c.Data); err != nil {
			t.Fatal(err)
		}
		return c
	}
	staleSender, staleRecipient := current(1), current(2)
	action := "00000000-0000-4000-8000-000000000001"
	if _, err = s.CreateItemTransfer(ctx, 3, 1, 1, 2, 1, "items", "staff", action); !errors.Is(err, ErrNotFound) {
		t.Fatalf("nonowner: %v", err)
	}
	if _, err = s.CreateItemTransfer(ctx, 1, 1, 1, 3, 1, "items", "staff", action); !errors.Is(err, ErrNotFound) {
		t.Fatalf("other session: %v", err)
	}
	if _, err = s.CreateItemTransfer(ctx, 1, 1, 1, 2, 1, "items", "missing", action); !errors.Is(err, ErrItemTransferConflict) {
		t.Fatalf("missing entry: %v", err)
	}
	var wg sync.WaitGroup
	results := make(chan ItemTransfer, 2)
	errs := make(chan error, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			v, e := s.CreateItemTransfer(ctx, 1, 1, 1, 2, 1, "items", "staff", action)
			results <- v
			errs <- e
		}()
	}
	wg.Wait()
	close(results)
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
	transfer := <-results
	retry := <-results
	if transfer.ID != retry.ID {
		t.Fatal("retry created another transfer")
	}
	if strings.Contains(string(current(1).Data), `"uid": "staff"`) {
		t.Fatal("sender still has reserved item")
	}
	if pending, err := s.PendingItemTransfers(ctx, 2); err != nil || len(pending) != 1 {
		t.Fatalf("pending: %+v %v", pending, err)
	}
	for _, sql := range []string{`DELETE FROM dndshare.session_participant WHERE char_id=1`, `UPDATE dndshare."char" SET deleted=true WHERE id=2`, `UPDATE dndshare."session" SET deleted=true WHERE id=1`} {
		if _, err := pool.Exec(ctx, sql); err == nil {
			t.Fatalf("pending item lost through %s", sql)
		}
	}
	if _, err = s.ResolveItemTransfer(ctx, 3, 2, transfer.ID, true); !errors.Is(err, ErrNotFound) {
		t.Fatalf("stranger decided: %v", err)
	}
	if _, err = s.ResolveItemTransfer(ctx, 1, 1, transfer.ID, true); !errors.Is(err, ErrNotFound) {
		t.Fatalf("sender accepted: %v", err)
	}
	errs = make(chan error, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); _, err := s.ResolveItemTransfer(ctx, 2, 2, transfer.ID, true); errs <- err }()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
	recipient := current(2)
	doc, _ := decodeTransferDocument(recipient.Data)
	items := doc.values()["items"].(map[string]any)["sections"].([]any)[0].(map[string]any)["items"].([]any)
	if len(items) != 1 {
		t.Fatalf("duplicate accepted item: %s", recipient.Data)
	}
	magic := items[0].(map[string]any)["params"].(map[string]any)["magic"].(map[string]any)
	if magic["remaining"] != float64(2) || magic["attuned"] != nil || magic["bonus_transfer"] != nil || magic["use_cooldowns"] == nil {
		t.Fatalf("wrong magic state: %+v", magic)
	}
	for _, c := range []transferCharacter{staleSender, staleRecipient} {
		err = s.UpdateCharacterDataWithEvents(ctx, c.UserID, CharacterItem{ID: c.ID, UserID: c.UserID, Version: c.Version}, c.Data, nil)
		if !errors.Is(err, ErrCharacterVersion) {
			t.Fatalf("stale save restored/lost item: %v", err)
		}
	}
	updates, err := s.SessionTransferEventUpdates(ctx, 1, transfer.EventID)
	if err != nil || len(updates) != 1 || !strings.Contains(string(updates[0].Data), `"accepted"`) {
		t.Fatalf("chronicle status: %+v %v", updates, err)
	}
	var eventCount int
	if err = pool.QueryRow(ctx, `SELECT count(*) FROM dndshare.session_event`).Scan(&eventCount); err != nil || eventCount != 1 {
		t.Fatalf("chronicle duplicated: %d %v", eventCount, err)
	}
	if _, err = s.ResolveItemTransfer(ctx, 2, 2, transfer.ID, false); !errors.Is(err, ErrItemTransferConflict) {
		t.Fatalf("accepted transfer rejected: %v", err)
	}
	// Custom potion stacks survive refusal unchanged; the sender can also recall.
	for _, decider := range []int64{2, 1} {
		c := current(1)
		action = "00000000-0000-4000-8000-00000000000" + string(rune('2'+decider))
		v, err := s.CreateItemTransfer(ctx, 1, 1, 1, 2, c.Version, "potions", "potion", action)
		if err != nil {
			t.Fatal(err)
		}
		if _, err = s.ResolveItemTransfer(ctx, decider, decider, v.ID, false); err != nil {
			t.Fatal(err)
		}
		doc, _ := decodeTransferDocument(current(1).Data)
		potions := doc.values()["potions"].([]any)
		raw, _ := json.Marshal(potions)
		if len(potions) != 1 || !strings.Contains(string(raw), `"count":3`) || !strings.Contains(string(raw), `"custom":7`) {
			t.Fatalf("lost stack params: %s", raw)
		}
	}
	// Both POST and incremental reads expose the correlation id for notification deduplication.
	rollAction := "00000000-0000-4000-8000-000000000009"
	roll, err := s.CreateSessionEvent(ctx, 1, 1, nil, nil, nil, "dice_roll", "Проверка", json.RawMessage(`{}`), "public", &rollAction)
	if err != nil || roll.ClientActionID == nil || *roll.ClientActionID != rollAction {
		t.Fatalf("created event correlation: %+v %v", roll, err)
	}
	page, err := s.GetSessionEvents(ctx, 1, 1, roll.ID-1, 100)
	if err != nil || len(page) != 1 || page[0].ClientActionID == nil || *page[0].ClientActionID != rollAction {
		t.Fatalf("read event correlation: %+v %v", page, err)
	}
	exec(`DELETE FROM dndshare.session_participant WHERE char_id=1`)
	if pending, err := s.PendingItemTransfers(ctx, 2); err != nil || len(pending) != 0 {
		t.Fatalf("resolved pending list: %+v %v", pending, err)
	}
}
