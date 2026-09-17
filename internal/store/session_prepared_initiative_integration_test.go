package store

import (
	"context"
	"encoding/json"
	"github.com/jackc/pgx/v5/pgxpool"
	"testing"
)

func testPreparedInitiative(t *testing.T, s *Store, pool *pgxpool.Pool) {
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `INSERT INTO dndshare."session"(id,owner_user_id) VALUES(995,1);
 INSERT INTO dndshare."char"(id,user_id,data) VALUES(9951,1,'{"values":{"name":"Герой"}}');
 INSERT INTO dndshare.session_participant VALUES(995,9951,1)`); err != nil {
		t.Fatal(err)
	}
	actor := int64(9951)
	roll := func(total int) {
		t.Helper()
		raw, _ := json.Marshal(map[string]any{"sheetInitiative": true, "result": map[string]any{"total": total}})
		if _, err := s.CreateSessionEvent(ctx, 995, 1, &actor, nil, nil, "dice_roll", "Инициатива", raw, "public", nil); err != nil {
			t.Fatal(err)
		}
	}
	read := func() map[string]any {
		t.Helper()
		raw, err := s.GetEncounterData(ctx, 995)
		if err != nil || raw == nil {
			t.Fatalf("read %v", err)
		}
		var doc map[string]any
		if err = json.Unmarshal([]byte(*raw), &doc); err != nil {
			t.Fatal(err)
		}
		return doc
	}
	save := func(doc map[string]any) {
		t.Helper()
		raw, _ := json.Marshal(doc)
		if err := s.SaveEncounterData(ctx, 995, "active", 1, string(raw)); err != nil {
			t.Fatal(err)
		}
	}
	creature := func(doc map[string]any) map[string]any { return object(array(doc["combatants"])[0]) }
	roll(18)
	doc := read()
	if creature(doc)["position"] != "reserve" || number(creature(doc)["initiative"]) != 18 {
		t.Fatalf("not prepared: %v", doc)
	}
	save(doc)
	creature(doc)["initiative"] = 7
	save(doc)
	if number(creature(read())["initiative"]) != 7 {
		t.Fatal("replayed old roll over manual edit")
	}
	roll(22)
	creature(doc)["position"] = "combat"
	doc["active"] = true
	save(doc)
	doc = read()
	if number(creature(doc)["initiative"]) != 22 {
		t.Fatal("lost fresh roll while entering combat")
	}
	roll(99)
	creature(doc)["position"] = "reserve"
	creature(doc)["initiative"] = nil
	doc["active"] = false
	save(doc)
	if creature(read())["initiative"] != nil {
		t.Fatal("applied a roll from active combat after leaving")
	}
}
