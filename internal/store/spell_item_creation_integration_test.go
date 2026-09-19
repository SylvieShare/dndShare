package store

import (
	"context"
	"encoding/json"
	"testing"
)

func testSpellItemCreation(t *testing.T, s *Store, exec func(string), current func(int64) transferCharacter) {
	ctx := context.Background()
	exec(`INSERT INTO dndshare.item(id,name,type_id,data) VALUES
 (90020,'Создание ягод',5,'{"lvl":1,"item_creation":[{"key":"berries","title":"Ягоды","choose_count":true,"outputs":[{"item":90001,"count":10,"per_slot":2,"scaling_step":2,"on_expire":"vanish","duration":{"kind":"hours","value":24}}]}]}');
 UPDATE dndshare."char" SET data='{"values":{"name":"Создатель","hp":{"current":1,"max":10},"spells":{"tabs":[{"casting_ability":5,"spells":[{"key":"creation","id":90020}]}],"slot_pools":{"short_rest":[{"level":3,"used":0,"total":2}]}}}}' WHERE id=1;`)
	req := SpellCastRequest{SpellID: 90020, EntryKey: "creation", CreationKey: "berries", CreatedCount: 13, Version: current(1).Version, ClientActionID: "00000000-0000-4000-8000-000000090020", CastLevel: 3, Pool: "short_rest", SpendSlot: true, Targets: []string{"self"}}
	if _, err := s.CastSpell(ctx, 1, 1, req); err == nil || current(1).Version != req.Version {
		t.Fatal("excess output committed", err)
	}
	req.CreatedCount = 7
	result, err := s.CastSpell(ctx, 1, 1, req)
	if err != nil || result.Self == nil || result.Self.Healing != nil || len(result.Self.CreatedItems) != 1 || result.Self.CreatedItems[0].Count != 7 {
		t.Fatal("creation", result, err)
	}
	version := current(1).Version
	again, err := s.CastSpell(ctx, 1, 1, req)
	if err != nil || current(1).Version != version || again.Self.CreatedItems[0].UID != result.Self.CreatedItems[0].UID {
		t.Fatal("creation retry duplicated output", err)
	}
	doc, _ := decodeTransferDocument(current(1).Data)
	entry := object(array(object(array(object(doc.values()["items"])["sections"])[0])["items"])[0])
	if number(entry["count"]) != 7 || number(object(doc.values()["hp"])["current"]) != 1 || number(object(array(object(object(doc.values()["spells"])["slot_pools"])["short_rest"])[0])["used"]) != 1 {
		t.Fatal("wrong cast mutation", doc)
	}
	creation := object(object(entry["params"])["creation"])
	if creation["on_expire"] != "vanish" || creation["cast_id"] != req.ClientActionID || number(creation["spell_id"]) != 90020 || number(object(creation["duration"])["value"]) != 24 {
		t.Fatal("lost provenance", creation)
	}
	if _, err := s.UseItemSelf(ctx, 1, 1, version, textValue(entry["uid"]), "00000000-0000-4000-8000-000000090021", "", "items"); err != nil {
		t.Fatal("created usable", err)
	}
	// Expiry is a game-time mark, not a wall-clock timeout.
	doc, _ = decodeTransferDocument(current(1).Data)
	entry = object(array(object(array(object(doc.values()["items"])["sections"])[0])["items"])[0])
	object(object(entry["params"])["creation"])["expired"] = true
	raw, _ := json.Marshal(doc)
	if _, err = s.pool.Exec(ctx, `UPDATE dndshare."char" SET data=$1::jsonb WHERE id=1`, json.RawMessage(raw)); err != nil {
		t.Fatal(err)
	}
	if _, err = s.UseItemSelf(ctx, 1, 1, current(1).Version, textValue(entry["uid"]), "00000000-0000-4000-8000-000000090022", "", "items"); err == nil {
		t.Fatal("expired item applied")
	}
}
