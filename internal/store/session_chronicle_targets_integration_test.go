package store

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func testChronicleTargets(t *testing.T, s *Store, pool *pgxpool.Pool) {
	ctx := context.Background()
	_, err := pool.Exec(ctx, `INSERT INTO dndshare."session"(id,owner_user_id) VALUES(996,1);
 INSERT INTO dndshare."char"(id,user_id,data) VALUES
 (9961,1,'{"values":{"name":"На кладбище","hp":{"current":10,"max":{"base":10}}}}'),
 (9962,1,'{"values":{"name":"Без сознания","hp":{"current":0,"max":{"base":10}}}}');
 INSERT INTO dndshare.session_participant VALUES(996,9961,1),(996,9962,1);
 INSERT INTO dndshare.session_encounter(session_id,data) VALUES(996,'{"combatants":[
 {"type":"player","charId":9961,"position":"dead"},
 {"type":"player","charId":9962,"position":"reserve"},
 {"type":"npc","uid":"dead-npc","position":"dead","hpCurrent":5},
 {"type":"npc","uid":"zero-npc","position":"reserve","hpCurrent":0}]}')`)
	if err != nil {
		t.Fatal(err)
	}
	all, err := s.SessionApplicationTargets(ctx, 1, 996)
	if err != nil || len(all) != 4 {
		t.Fatalf("general application targets: %v %v", all, err)
	}
	available, err := s.SessionSaveTargets(ctx, 1, 996)
	if err != nil || len(available) != 2 {
		t.Fatalf("chronicle targets: %v %v", available, err)
	}
	for _, target := range available {
		if target.Name == "На кладбище" || target.NPCUID == "dead-npc" || target.Snapshot == nil || target.HP.Current != 0 {
			t.Fatalf("unexpected target: %+v", target)
		}
	}
	canonical, err := s.sessionChronicleTargets(ctx, 1, 996)
	if err != nil || len(canonical) != 2 || canonical[0].Snapshot != nil {
		t.Fatalf("canonical targets: %v %v", canonical, err)
	}
	event, err := s.CreateSessionEvent(ctx, 996, 1, nil, nil, nil, "dice_roll", "Атака", json.RawMessage(`{"attackRoll":true,"damageRoll":false,"result":{"total":15,"parts":[{"kind":"dice","sides":20,"rolls":[15],"sum":15}]},"savingThrow":{"ability":2,"dc":15,"results":[]}}`), "public", nil)
	if err != nil {
		t.Fatal(err)
	}
	for _, target := range all {
		if target.Name != "На кладбище" && target.NPCUID != "dead-npc" {
			continue
		}
		if _, err = s.SetSessionAttackTargets(ctx, 1, 996, event.ID, []ApplicationTarget{target}); !errors.Is(err, ErrApplication) {
			t.Fatalf("dead attack target: %v", err)
		}
		if _, err = s.AppendSessionSaves(ctx, 1, 996, event.ID, []SessionSaveResult{{Target: target, Result: json.RawMessage(`{"total":10,"parts":[{"kind":"dice","sides":20,"rolls":[10],"sum":10}]}`)}}); !errors.Is(err, ErrApplication) {
			t.Fatalf("dead save target: %v", err)
		}
		if _, err = s.ApplySessionImpact(ctx, 1, 996, SessionImpactRequest{Amount: 2, ClientActionID: "99600000-0000-4000-8000-000000000001", Targets: []SessionImpactTarget{{Target: target}}}); !errors.Is(err, ErrApplication) {
			t.Fatalf("dead impact target: %v", err)
		}
	}
	if _, err = s.SetSessionAttackTargets(ctx, 1, 996, event.ID, canonical); err != nil {
		t.Fatalf("zero HP remains targetable: %v", err)
	}
}
