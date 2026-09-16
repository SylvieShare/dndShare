package store

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"testing"
)

func testSessionImpacts(t *testing.T, s *Store, pool *pgxpool.Pool) {
	ctx := context.Background()
	exec := func(sql string) {
		t.Helper()
		if _, err := pool.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	exec(`CREATE TABLE dndshare.suggest(id bigint,type_id bigint,value text,user_id bigint);
 INSERT INTO dndshare.suggest VALUES(5,12,'Огонь',NULL);
 INSERT INTO dndshare."session"(id,owner_user_id) VALUES(990,3);
 INSERT INTO dndshare."char"(id,user_id,data) VALUES(990,1,'{"values":{"name":"Цель","hp":{"current":20,"temp":3,"max":20},"defenses":[{"damage_type":5,"kind":"resistance"}]}}');
 INSERT INTO dndshare.session_participant VALUES(990,990,1);
 INSERT INTO dndshare.item(id,type_id,name,data) VALUES(990003,5,'Пламя','{"lvl":1,"status_effects":[{"key":"burn","effect":{"id":990004}}]}'),(990004,15,'Горение','{"duration":{"kind":"rounds","value":2}}');`)
	defer exec(`DELETE FROM dndshare.character_concentration WHERE char_id=990;
 DELETE FROM dndshare.session_event WHERE session_id=990;
 DELETE FROM dndshare.session_encounter WHERE session_id=990;
 DELETE FROM dndshare.session_participant WHERE session_id=990;
 DELETE FROM dndshare."char" WHERE id=990; DELETE FROM dndshare."session" WHERE id=990;
 DELETE FROM dndshare.item WHERE id IN(990003,990004); DROP TABLE dndshare.suggest;`)
	if err := s.SaveEncounterData(ctx, 990, "", 0, `{"combatants":[{"uid":"goblin","type":"npc","hpCurrent":20,"hpTemp":2,"override":{"name":"Гоблин","hp":20},"impactHistory":[{"fake":true}]}]}`); err != nil {
		t.Fatal(err)
	}
	targets, err := s.SessionApplicationTargets(ctx, 3, 990)
	if err != nil || len(targets) != 2 {
		t.Fatalf("targets: %v %v", targets, err)
	}
	hero, npc := targets[0], targets[1]
	getNPC := func() map[string]any {
		t.Helper()
		raw, err := s.GetEncounterData(ctx, 990)
		if err != nil {
			t.Fatal(err)
		}
		var doc map[string]any
		json.Unmarshal([]byte(*raw), &doc)
		return object(array(doc["combatants"])[0])
	}
	if len(array(getNPC()["impactHistory"])) != 0 {
		t.Fatal("new NPC accepted spoofed history")
	}
	create := func() SessionEvent {
		t.Helper()
		actor := int64(990)
		e, err := s.CreateSessionEvent(ctx, 990, 3, &actor, nil, nil, "dice_roll", "Пламя", json.RawMessage(`{"damageRoll":true,"source":{"itemId":990003},"result":{"total":15,"byType":[{"value":15,"label":"Огонь"}]},"savingThrow":{"ability":2,"dc":15,"onSuccess":"half","results":[]}}`), "public", nil)
		if err != nil {
			t.Fatal(err)
		}
		return e
	}
	event := create()
	_, err = s.AppendSessionSaves(ctx, 3, 990, event.ID, []SessionSaveResult{{Target: hero, Result: json.RawMessage(`{"total":5,"parts":[{"kind":"dice","sides":20,"rolls":[5]}]}`)}, {Target: npc, Result: json.RawMessage(`{"total":20,"parts":[{"kind":"dice","sides":20,"rolls":[20]}]}`)}})
	if err != nil {
		t.Fatal(err)
	}
	req := SessionImpactRequest{EventID: event.ID, ClientActionID: "00000000-0000-4000-8000-000000000990", EffectKey: "burn", Targets: []SessionImpactTarget{{hero, "success"}, {npc, "failure"}}}
	if _, err = s.ApplySessionImpact(ctx, 1, 990, req); err == nil {
		t.Fatal("player applied damage")
	}
	response, err := s.ApplySessionImpact(ctx, 3, 990, req)
	if err != nil {
		t.Fatal(err)
	}
	var data map[string]any
	json.Unmarshal(response.Event.Data, &data)
	impacts := array(data["impacts"])
	if len(impacts) != 2 || number(object(impacts[0])["total"]) != 3 || number(object(impacts[1])["total"]) != 15 || len(array(object(impacts[0])["effects"])) != 0 || len(array(object(impacts[1])["effects"])) != 1 {
		t.Fatalf("outcome override: %s", response.Event.Data)
	}
	c := getNPC()
	if number(c["hpCurrent"]) != 7 || number(c["hpTemp"]) != 0 || len(array(c["impactHistory"])) != 1 || len(array(c["effectInstances"])) != 1 {
		t.Fatalf("npc %+v", c)
	}
	if _, err = s.ApplySessionImpact(ctx, 3, 990, req); err != nil {
		t.Fatal(err)
	}
	if number(getNPC()["hpCurrent"]) != 7 || len(array(getNPC()["impactHistory"])) != 1 {
		t.Fatal("retry applied twice")
	}
	req.ClientActionID = "00000000-0000-4000-8000-000000000991"
	if _, err = s.ApplySessionImpact(ctx, 3, 990, req); err == nil {
		t.Fatal("same event/target accepted twice")
	}
	// Current server history survives a stale client copy; ordinary HP changes append one record.
	raw, _ := s.GetEncounterData(ctx, 990)
	var enc map[string]any
	json.Unmarshal([]byte(*raw), &enc)
	c = object(array(enc["combatants"])[0])
	c["impactHistory"] = []any{}
	c["hpCurrent"] = 6
	encoded, _ := json.Marshal(enc)
	if err = s.SaveEncounterData(ctx, 990, "", 0, string(encoded)); err != nil {
		t.Fatal(err)
	}
	if len(array(getNPC()["impactHistory"])) != 2 {
		t.Fatal("history overwritten")
	}
	manual := SessionImpactRequest{ClientActionID: "00000000-0000-4000-8000-000000000992", Amount: 2, Targets: []SessionImpactTarget{{npc, ""}}}
	first, err := s.ApplySessionImpact(ctx, 3, 990, manual)
	if err != nil {
		t.Fatal(err)
	}
	second, err := s.ApplySessionImpact(ctx, 3, 990, manual)
	if err != nil || first.Event.ID != second.Event.ID || number(getNPC()["hpCurrent"]) != 4 {
		t.Fatalf("manual retry %v", err)
	}
	manual.Amount = 3
	if _, err = s.ApplySessionImpact(ctx, 3, 990, manual); err == nil {
		t.Fatal("same action changed amount")
	}
	manual.ClientActionID = "00000000-0000-4000-8000-000000000993"
	manual.Targets = append(manual.Targets, SessionImpactTarget{ApplicationTarget{Kind: "npc", NPCUID: "foreign", EncounterID: npc.EncounterID}, ""})
	if _, err = s.ApplySessionImpact(ctx, 3, 990, manual); err == nil || number(getNPC()["hpCurrent"]) != 4 {
		t.Fatal("invalid target not atomic")
	}
	// A stale encounter cannot overwrite a server-side application.
	if err = s.SaveEncounterData(ctx, 990, "", 0, string(encoded)); err == nil {
		t.Fatal("stale application revision accepted")
	}
	var count int
	if err = pool.QueryRow(ctx, `SELECT count(*) FROM dndshare.session_event WHERE session_id=990 AND event_type='damage_applied'`).Scan(&count); err != nil || count != 2 {
		t.Fatal(fmt.Sprint("manual chronicle ", count, err))
	}
	exec(`UPDATE dndshare.item SET data=data||'{"concentration":true}'::jsonb WHERE id=990003`)
	concentrated := create()
	if _, err = s.AppendSessionSaves(ctx, 3, 990, concentrated.ID, []SessionSaveResult{{Target: hero, Result: json.RawMessage(`{"total":5,"parts":[{}]}`)}, {Target: npc, Result: json.RawMessage(`{"total":20,"parts":[{}]}`)}}); err != nil {
		t.Fatal(err)
	}
	success := SessionImpactRequest{EventID: concentrated.ID, ClientActionID: "00000000-0000-4000-8000-000000000994", EffectKey: "burn", Targets: []SessionImpactTarget{{hero, "success"}}}
	if _, err = s.ApplySessionImpact(ctx, 3, 990, success); err != nil {
		t.Fatal(err)
	}
	if current, err := s.CharacterConcentration(ctx, 990); err != nil || current != nil {
		t.Fatalf("success started concentration: %+v %v", current, err)
	}
	success.ClientActionID = "00000000-0000-4000-8000-000000000995"
	success.Targets = []SessionImpactTarget{{npc, "failure"}}
	if _, err = s.ApplySessionImpact(ctx, 3, 990, success); err != nil {
		t.Fatal(err)
	}
	current, err := s.CharacterConcentration(ctx, 990)
	if err != nil || current == nil || len(current.Effects) != 1 || current.Effects[0].Target.NPCUID != "goblin" {
		t.Fatalf("concentration links: %+v %v", current, err)
	}
	historyCount := len(array(getNPC()["impactHistory"]))
	var version int64
	if err = pool.QueryRow(ctx, `SELECT version FROM dndshare."char" WHERE id=990`).Scan(&version); err != nil {
		t.Fatal(err)
	}
	if _, err = s.ChangeConcentration(ctx, 1, 990, version, 0, "00000000-0000-4000-8000-000000000996", current.ID); err != nil {
		t.Fatal(err)
	}
	if len(array(getNPC()["effectInstances"])) != 0 || len(array(getNPC()["impactHistory"])) != historyCount+1 {
		t.Fatal("concentration removal missing from history")
	}

}
