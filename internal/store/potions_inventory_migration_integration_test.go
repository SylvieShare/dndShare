package store

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func testPotionsInventoryMigration(t *testing.T, s *Store, pool *pgxpool.Pool, exec func(string)) {
	ctx := context.Background()
	exec(`INSERT INTO dndshare."char"(id,user_id,data,deleted) VALUES
 (1001,1,'{"values":{"hp":{"current":7},"items":{"equipped":[{"uid":"worn","item_id":12}],"sections":[{"id":"bag","name":"Сумка","items":[{"uid":"rope","count":5}],"slots":{"rope":5,"worn":1}},{"id":"chest","name":"Сундук","items":[]}]},"potions":[{"uid":"custom","item_id":null,"name":"Свой отвар","count":4,"icon_preset_id":7,"params":{"custom":9},"override":{"desc":"Описание"}}]},"var":{"note":"keep"}}',false),
 (1002,2,'{"values":{"potions":[{"uid":"deleted-dose","count":2,"override":{"name":"Зелье"}}]}}',true),
 (1003,1,'{"values":{"name":"Дозы","potions":[{"uid":"dose","item_id":84,"count":2,"params":{"custom":7}}]}}',false),
 (1004,1,'{"values":{"name":"Последняя доза","potions":[]}}',false);
 INSERT INTO dndshare.session_participant(session_id,char_id,user_id) VALUES(1,1003,1),(1,1004,1);
 INSERT INTO dndshare.session_event(id,session_id,author_user_id,event_type,action,data,visibility) VALUES
 (1001,1,1,'item_transfer','Применение','{}','public'),(1002,1,1,'item_transfer','Применение','{}','public');
 INSERT INTO dndshare.item_transfer(session_id,sender_char_id,recipient_char_id,client_action_id,event_id,source,entry,item_name,sender_name,recipient_name,purpose)
 VALUES(1,1003,2,'70000000-0000-4000-8000-000000000001',1001,'potions','{"uid":"dose","item_id":84,"count":1,"params":{"custom":7},"_use_origin":"potions"}','Зелье','Дозы','Цель','use'),
 (1,1004,2,'70000000-0000-4000-8000-000000000002',1002,'potions','{"uid":"last","count":1,"override":{"name":"Зелье"},"_use_origin":"potions"}','Зелье','Последняя доза','Цель','use');
 INSERT INTO dndshare.item_application(char_id,client_action_id,entry_uid,result,source) VALUES(1003,'70000000-0000-4000-8000-000000000003','dose','{}','potions');
 INSERT INTO dndshare.session_inventory(session_id,source,item_name,entry,slot) VALUES(1,'potions','Зелье','{"uid":"session-dose","count":3}',0);`)
	defer exec(`DELETE FROM dndshare.item_transfer WHERE sender_char_id IN (1003,1004);
 DELETE FROM dndshare.session_event WHERE id IN (1001,1002);
 DELETE FROM dndshare.session_inventory WHERE item_name='Зелье' AND entry->>'uid'='session-dose';
 DELETE FROM dndshare.session_participant WHERE char_id IN (1003,1004);
 DELETE FROM dndshare."char" WHERE id BETWEEN 1001 AND 1004;`)
	exec(schemaPotionsInventorySQL)
	read := func(id int64) (transferDocument, int64) {
		t.Helper()
		var raw json.RawMessage
		var version int64
		if err := pool.QueryRow(ctx, `SELECT data,version FROM dndshare."char" WHERE id=$1`, id).Scan(&raw, &version); err != nil {
			t.Fatal(err)
		}
		doc, err := decodeTransferDocument(raw)
		if err != nil {
			t.Fatal(err)
		}
		if _, found := doc.values()["potions"]; found {
			t.Fatalf("old collection remains: %s", raw)
		}
		return doc, version
	}
	doc, version := read(1001)
	inventory := object(doc.values()["items"])
	spaces := array(inventory["sections"])
	bag := object(spaces[0])
	rows := array(bag["items"])
	if version != 2 || len(rows) != 2 || len(spaces) != 2 || len(array(inventory["equipped"])) != 1 || number(object(doc.values()["hp"])["current"]) != 7 || object(doc["var"])["note"] != "keep" {
		t.Fatalf("unrelated data changed: %+v", doc)
	}
	potion := object(rows[1])
	slots := object(bag["slots"])
	if potion["uid"] != "custom" || number(potion["count"]) != 4 || number(potion["icon_preset_id"]) != 7 || number(object(potion["params"])["custom"]) != 9 || object(potion["override"])["name"] != "Свой отвар" || object(potion["override"])["desc"] != "Описание" || number(slots["rope"]) != 5 || number(slots["worn"]) != 1 || number(slots["custom"]) != 0 {
		t.Fatalf("instance/slots lost: %+v", doc)
	}
	deleted, _ := read(1002)
	if len(potionTestEntries(deleted)) != 1 {
		t.Fatal("deleted character was not migrated")
	}
	var remaining int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM dndshare.item_application WHERE source='potions'`).Scan(&remaining); err != nil || remaining != 0 {
		t.Fatalf("receipt source: %v %d", err, remaining)
	}
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM dndshare.session_inventory WHERE source='potions'`).Scan(&remaining); err != nil || remaining != 0 {
		t.Fatalf("session source: %v %d", err, remaining)
	}
	for _, event := range []int64{1001, 1002} {
		var id int64
		if err := pool.QueryRow(ctx, `SELECT id FROM dndshare.item_transfer WHERE event_id=$1`, event).Scan(&id); err != nil {
			t.Fatal(err)
		}
		if _, err := s.ResolveItemTransfer(ctx, 2, 2, id, false); err != nil {
			t.Fatal(err)
		}
	}
	returned, _ := read(1003)
	if number(object(potionTestEntries(returned)[0])["count"]) != 3 {
		t.Fatalf("reserved dose did not rejoin original stack: %+v", returned)
	}
	last, _ := read(1004)
	if len(potionTestEntries(last)) != 1 {
		t.Fatalf("last dose did not return to the new backpack: %+v", last)
	}
	_, receiptVersion := read(1003)
	if _, err := s.UseItemSelf(ctx, 1, 1003, 0, "dose", "70000000-0000-4000-8000-000000000003", "", "items"); err != nil {
		t.Fatal("migrated receipt replay", err)
	}
	_, afterReplay := read(1003)
	if afterReplay != receiptVersion {
		t.Fatal("receipt replay consumed a second dose")
	}
	exec(`INSERT INTO dndshare.item(id,type_id,name,data) VALUES(90020,10,'Зелье кладовщика','{"usable":{"healing":"1"}}')`)
	defer exec(`DELETE FROM dndshare.session_inventory WHERE entry->>'item_id'='90020'; DELETE FROM dndshare.session_event WHERE data#>>'{source,itemId}'='90020'; DELETE FROM dndshare.item WHERE id=90020`)
	if err := s.AddSessionInventory(ctx, 1, 3, "items", "ignored", "70000000-0000-4000-8000-000000000004", json.RawMessage(`{"item_id":90020,"count":4,"params":{"custom":8}}`)); err != nil {
		t.Fatal("potion catalogue addition", err)
	}
	entries, _, err := s.SessionInventory(ctx, 1, 3)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, row := range entries {
		if row.Name == "Зелье кладовщика" && row.Source == "items" {
			found = true
		}
	}
	if !found {
		t.Fatal("potion did not use shared session inventory source")
	}
	if _, err := pool.Exec(ctx, `UPDATE dndshare."char" SET data=jsonb_set(data,'{values,potions}','[]') WHERE id=1001`); err == nil {
		t.Fatal("obsolete collection can be saved again")
	}
}
