package store

import (
	"context"
	"dndshare/internal/testdb"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"strings"
	"sync"
	"testing"
)

func TestItemTransfersPostgres(t *testing.T) {
	f := newTransferFixture(t)
	s, pool := f.store, f.pool
	ctx := context.Background()
	exec := f.exec
	var err error

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
	if transfer.AuthorUserID != 1 || transfer.RecipientUserID != 2 || transfer.SessionOwnerUserID != 3 {
		t.Fatalf("offer audience: %+v", transfer)
	}
	if transfer.SenderImageURL == nil || *transfer.SenderImageURL != "/sender.png" {
		t.Fatalf("sender icon: %+v", transfer)
	}
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
	for _, attempt := range [][2]int64{{1, 1}, {2, 1}, {3, 999}} {
		if _, err = s.ApproveSessionTransfer(ctx, attempt[0], attempt[1], transfer.EventID); !errors.Is(err, ErrNotFound) {
			t.Fatalf("unauthorized session approval: %v", err)
		}
	}
	errs = make(chan error, 2)
	wg.Add(1)
	go func() { defer wg.Done(); _, err := s.ApproveSessionTransfer(ctx, 3, 1, transfer.EventID); errs <- err }()
	for i := 0; i < 1; i++ {
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
	updates, err := s.SessionMutableEventUpdates(ctx, 1, 3, transfer.EventID)
	if err != nil || len(updates) != 1 || updates[0].RecipientImageURL == nil || *updates[0].RecipientImageURL != "/recipient.png" || !strings.Contains(string(updates[0].Data), `"accepted"`) {
		t.Fatalf("chronicle status: %+v %v", updates, err)
	}
	var eventCount int
	if err = pool.QueryRow(ctx, `SELECT count(*) FROM dndshare.session_event`).Scan(&eventCount); err != nil || eventCount != 1 {
		t.Fatalf("chronicle duplicated: %d %v", eventCount, err)
	}
	if _, err = s.ApproveSessionTransfer(ctx, 3, 1, transfer.EventID); err != nil {
		t.Fatalf("repeat approval: %v", err)
	}
	if _, err = s.ResolveItemTransfer(ctx, 2, 2, transfer.ID, false); !errors.Is(err, ErrItemTransferConflict) {
		t.Fatalf("accepted transfer rejected: %v", err)
	}
	// Custom potion stacks survive refusal unchanged; the sender can also recall.
	for _, decider := range []int64{2, 1} {
		c := current(1)
		action = "00000000-0000-4000-8000-00000000000" + string(rune('2'+decider))
		v, err := s.CreateItemTransfer(ctx, 1, 1, 1, 2, c.Version, "items", "potion", action)
		if err != nil {
			t.Fatal(err)
		}
		if _, err = s.ResolveItemTransfer(ctx, decider, decider, v.ID, false); err != nil {
			t.Fatal(err)
		}
		if _, err = s.ApproveSessionTransfer(ctx, 3, 1, v.EventID); !errors.Is(err, ErrItemTransferConflict) {
			t.Fatalf("DM approved rejected offer: %v", err)
		}
		doc, _ := decodeTransferDocument(current(1).Data)
		potions := potionTestEntries(doc)
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
	page, err := s.GetSessionEvents(ctx, 1, 3, roll.ID-1, 100)
	if err != nil || len(page) != 1 || page[0].ClientActionID == nil || *page[0].ClientActionID != rollAction {
		t.Fatalf("read event correlation: %+v %v", page, err)
	}
	for _, reader := range []int64{1, 2, 3} {
		visible, err := s.GetSessionEvents(ctx, 1, reader, 0, 100)
		if err != nil {
			t.Fatal(err)
		}
		changed, err := s.SessionMutableEventUpdates(ctx, 1, reader, roll.ID)
		if err != nil {
			t.Fatal(err)
		}
		if reader == 1 && (len(visible) != 0 || len(changed) != 0) {
			t.Fatalf("sender sees other actors: %+v %+v", visible, changed)
		}
		if reader == 2 {
			if len(visible) != 3 || len(changed) != 3 {
				t.Fatalf("recipient transfer count: %d %d", len(visible), len(changed))
			}
			for _, e := range append(visible, changed...) {
				if e.EventType != "item_transfer" || e.RecipientUserID == nil || *e.RecipientUserID != reader {
					t.Fatalf("unaddressed event: %+v", e)
				}
			}
		}
		if reader == 3 && len(visible) != 4 {
			t.Fatalf("owner lost history: %+v", visible)
		}
	}
	if _, err = s.ApproveSessionTransfer(ctx, 3, 1, roll.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("ordinary event approved: %v", err)
	}
	offer, err := s.CreateItemTransfer(ctx, 1, 1, 1, 2, current(1).Version, "items", "potion", "00000000-0000-4000-8000-000000000010")
	if err != nil {
		t.Fatal(err)
	}
	approved, err := s.ApproveSessionTransfer(ctx, 3, 1, offer.EventID)
	if err != nil || approved.Status != "accepted" {
		t.Fatalf("DM approval: %+v %v", approved, err)
	}
	approvedDoc, _ := decodeTransferDocument(current(2).Data)
	delivered := false
	for _, entry := range potionTestEntries(approvedDoc) {
		if object(entry)["uid"] == fmt.Sprintf("transfer-%d", approved.ID) && number(object(entry)["count"]) == 3 {
			delivered = true
		}
	}
	if !delivered {
		t.Fatal("DM approval did not deliver potion stack")
	}
	exec(`DELETE FROM dndshare.session_participant WHERE char_id=1`)
	if pending, err := s.PendingItemTransfers(ctx, 2); err != nil || len(pending) != 0 {
		t.Fatalf("resolved pending list: %+v %v", pending, err)
	}

}

type transferFixture struct {
	store *Store
	pool  *pgxpool.Pool
	exec  func(string)
}

func newTransferFixture(t *testing.T) transferFixture {
	t.Helper()
	pool := testdb.Pool(t)
	ctx := context.Background()
	exec := func(sql string) {
		t.Helper()
		if _, err := pool.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	exec(`CREATE SCHEMA dndshare;
 CREATE TABLE dndshare.users(id bigint PRIMARY KEY,login text);
 CREATE TABLE dndshare.source_version(id bigint PRIMARY KEY,version text);
 INSERT INTO dndshare.source_version VALUES(1,'2014');
 CREATE TABLE dndshare.storage_image(id bigint PRIMARY KEY,url text,deleted bool DEFAULT false);
 CREATE TABLE dndshare.svg_storage(id bigint PRIMARY KEY,data text);
 CREATE TABLE dndshare.item_type(id bigint PRIMARY KEY,fields jsonb DEFAULT '[]');
 CREATE TABLE dndshare.item(id bigint PRIMARY KEY,name text,user_id bigint,type_id bigint,data jsonb DEFAULT '{}',icon_image_id bigint,cover_image_id bigint,icon_svg_id bigint);
 CREATE TABLE dndshare."session"(id bigint PRIMARY KEY,uuid uuid DEFAULT gen_random_uuid(),owner_user_id bigint,settings jsonb DEFAULT '{}',deleted bool DEFAULT false);
 CREATE TABLE dndshare."char"(id bigint PRIMARY KEY,uuid uuid DEFAULT gen_random_uuid(),user_id bigint,template_id bigint,icon_image_id bigint,source_version_id bigint DEFAULT 1,
 data jsonb DEFAULT '{"values":{}}',version bigint DEFAULT 1,changed_at timestamptz DEFAULT now(),deleted bool DEFAULT false);
 CREATE TABLE dndshare.session_encounter(id bigserial PRIMARY KEY,session_id bigint,revision bigint NOT NULL DEFAULT 1,data jsonb,status text,round int,changed_at timestamptz DEFAULT now(),deleted bool DEFAULT false);
 CREATE TABLE dndshare.session_participant(session_id bigint,char_id bigint PRIMARY KEY,user_id bigint);
 CREATE TABLE dndshare.session_event(id bigserial PRIMARY KEY,session_id bigint,author_user_id bigint,actor_char_id bigint,actor_item_id bigint,
 actor_name text,event_type text,action text,data jsonb,visibility text,created_at timestamptz DEFAULT now(),deleted bool DEFAULT false,client_action_id uuid);
 CREATE UNIQUE INDEX event_action ON dndshare.session_event(session_id,client_action_id) WHERE client_action_id IS NOT NULL;
 INSERT INTO dndshare.users VALUES(1,'Sender'),(2,'Recipient'),(3,'Outsider');
 INSERT INTO dndshare.item(id,name) VALUES(30,'Посох');
 INSERT INTO dndshare."session"(id,owner_user_id) VALUES(1,3),(2,3);
 INSERT INTO dndshare."char"(id,user_id,data) VALUES
 (1,1,'{"values":{"name":"Лиора","items":{"equipped":[{"uid":"staff","item_id":30,"count":1,"params":{"magic":{"attuned":true,"remaining":2,"bonus_transfer":2,"use_cooldowns":{"wish":3}}}}],"sections":[{"id":"bag","name":"Рюкзак","items":[{"uid":"potion","item_id":null,"count":3,"override":{"name":"Зелье","desc":"Особое"},"params":{"custom":7}}]}]}}}'),
 (2,2,'{"values":{"name":"Торин","hp":{"current":10}}}'),(3,3,'{"values":{"name":"Чужой"}}');
 INSERT INTO dndshare.session_participant VALUES(1,1,1),(1,2,2),(2,3,3);`)
	exec(testSchemaTables(t, "character_change", "item_transfer", "session_interaction", "item_application", "character_concentration", "concentration_effect", "spell_cast_receipt", "session_karmic_scale", "session_d20_roll", "session_inventory"))
	exec(testSchemaTriggers(t, "guard_pending_item_transfers"))
	exec(testSchemaTriggers(t, "bump_session_encounter_revision"))
	if _, err := pool.Exec(ctx, `UPDATE dndshare.session SET settings=$1::jsonb`, testSessionSettingsJSON(t)); err != nil {
		t.Fatal(err)
	}
	exec(`INSERT INTO dndshare.item_type(id,fields) VALUES(10,'[]'),(2,'[]'),(5,'[]'),(15,'[]');
 INSERT INTO dndshare.item(id,name,type_id,data) VALUES(90010,'Зелье',10,'{"usable":{"healing":"2d4+2","choices":[{"key":"first"}],"status_effects":[{"key":"effect","effect":{"id":30}}]}}');`)
	for _, typeID := range []int{2, 5, 10, 15} {
		fields := testItemFields(t, typeID)
		if _, err := pool.Exec(ctx, `UPDATE dndshare.item_type SET fields=$2::jsonb WHERE id=$1`, typeID, fields); err != nil {
			t.Fatal(err)
		}
	}
	exec(`INSERT INTO dndshare.storage_image(id,url) VALUES(1,'/sender.png'),(2,'/recipient.png');
 UPDATE dndshare."char" SET icon_image_id=id WHERE id IN (1,2);`)

	installActiveItemFixture(t, pool)
	return transferFixture{store: &Store{pool: pool}, pool: pool, exec: exec}
}

func (f transferFixture) current(t *testing.T, id int64) transferCharacter {
	t.Helper()
	var result transferCharacter
	if err := f.pool.QueryRow(t.Context(), `SELECT id,user_id,version,data FROM dndshare."char" WHERE id=$1`, id).Scan(&result.ID, &result.UserID, &result.Version, &result.Data); err != nil {
		t.Fatal(err)
	}
	return result
}

func TestCharacterSessionPersistencePostgres(t *testing.T) {
	for _, scenario := range []struct {
		name string
		run  func(*testing.T, transferFixture)
	}{
		{"rps constraints", func(t *testing.T, f transferFixture) { testRPSInvitationConstraints(t, f.pool) }},
		{"document history", func(t *testing.T, f transferFixture) { testCharacterDocumentHistory(t, f.store) }},
		{"session impacts", func(t *testing.T, f transferFixture) { testSessionImpacts(t, f.store, f.pool) }},
		{"session saves", func(t *testing.T, f transferFixture) { testSessionSaves(t, f.store, f.pool) }},
		{"session attack targets", func(t *testing.T, f transferFixture) { testSessionAttackTargets(t, f.store, f.pool) }},
		{"application targets", func(t *testing.T, f transferFixture) { testApplicationTargets(t, f.store, f.pool) }},
		{"money transfers", func(t *testing.T, f transferFixture) { testMoneyTransfersPostgres(t, f.store) }},
		{"player interactions", func(t *testing.T, f transferFixture) { testSessionInteractionsPostgres(t, f.store) }},
		{"potion requests", func(t *testing.T, f transferFixture) {
			testPotionUseRequests(t, f.store, f.exec, func(id int64) transferCharacter { return f.current(t, id) })
		}},
		{"potion applications", func(t *testing.T, f transferFixture) {
			testPotionApplications(t, f.store, f.exec, func(id int64) transferCharacter { return f.current(t, id) })
		}},
		{"usable applications", func(t *testing.T, f transferFixture) {
			testUsableApplications(t, f.store, f.exec, func(id int64) transferCharacter { return f.current(t, id) })
		}},
		{"spell item creation", func(t *testing.T, f transferFixture) {
			testSpellItemCreation(t, f.store, f.exec, func(id int64) transferCharacter { return f.current(t, id) })
		}},
		{"session inventory", func(t *testing.T, f transferFixture) { testSessionInventory(t, f.store, f.pool) }},
		{"inventory grid", func(t *testing.T, f transferFixture) { testSessionInventoryGrid(t, f.store) }},
		{"prepared initiative", func(t *testing.T, f transferFixture) { testPreparedInitiative(t, f.store, f.pool) }},
		{"chronicle targets", func(t *testing.T, f transferFixture) { testChronicleTargets(t, f.store, f.pool) }},
		{"roll sequences", func(t *testing.T, f transferFixture) { testSessionSequences(t, f.store, f.pool) }},
	} {
		t.Run(scenario.name, func(t *testing.T) { scenario.run(t, newTransferFixture(t)) })
	}
}
