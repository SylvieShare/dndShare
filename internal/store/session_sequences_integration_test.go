package store

import (
	"context"
	"encoding/json"
	"github.com/jackc/pgx/v5/pgxpool"
	"testing"
)

func testSessionSequences(t *testing.T, s *Store, pool *pgxpool.Pool) {
	ctx := context.Background()
	_, err := pool.Exec(ctx, `INSERT INTO dndshare."session"(id,owner_user_id) VALUES(994,3);
 INSERT INTO dndshare."char"(id,user_id,data) VALUES(9941,1,'{"values":{"name":"Цель","hp":{"current":40,"max":{"base":40}}}}');
 INSERT INTO dndshare.session_participant VALUES(994,9941,1);`)
	if err != nil {
		t.Fatal(err)
	}
	targets, err := s.sessionChronicleTargets(ctx, 3, 994)
	if err != nil || len(targets) != 1 {
		t.Fatal(targets, err)
	}
	seq := sequenceFixture(t, "damage", "matching_damage")
	data, _ := json.Marshal(map[string]any{"attackRoll": true, "result": object(array(seq["hits"])[0])["attack"], "sequence": seq})
	event, err := s.CreateSessionEvent(ctx, 994, 1, nil, nil, nil, "dice_roll", "Цепочка", data, "public", nil)
	if err != nil {
		t.Fatal(err)
	}
	cmd := SequenceCommand{Action: "target", Target: targets[0], ClientActionID: "99400000-0000-4000-8000-000000000001"}
	if _, err := s.AdvanceSessionSequence(ctx, 2, 994, event.ID, cmd); err == nil {
		t.Fatal("outsider changed cast")
	}
	if _, err := s.AdvanceSessionSequence(ctx, 3, 994, event.ID, cmd); err != nil {
		t.Fatal(err)
	}
	if _, err := s.AdvanceSessionSequence(ctx, 3, 994, event.ID, cmd); err != nil {
		t.Fatal("retry failed", err)
	}
	cmd.ClientActionID = "99400000-0000-4000-8000-000000000002"
	if _, err := s.AdvanceSessionSequence(ctx, 3, 994, event.ID, cmd); err == nil {
		t.Fatal("stale revision accepted")
	}
	// Freeze a known ready result; impact application must read this hit, not the root attack.
	var raw json.RawMessage
	if err := pool.QueryRow(ctx, `SELECT data FROM dndshare.session_event WHERE id=$1`, event.ID).Scan(&raw); err != nil {
		t.Fatal(err)
	}
	var root map[string]any
	_ = json.Unmarshal(raw, &root)
	hit := object(array(object(root["sequence"])["hits"])[0])
	hit["status"], hit["damageRoll"] = "ready", true
	hit["result"] = map[string]any{"total": 7, "byType": []any{map[string]any{"value": 7}}}
	raw, _ = json.Marshal(root)
	if _, err := pool.Exec(ctx, `UPDATE dndshare.session_event SET data=$2::jsonb WHERE id=$1`, event.ID, raw); err != nil {
		t.Fatal(err)
	}
	index := 0
	req := SessionImpactRequest{EventID: event.ID, SequenceIndex: &index, ClientActionID: "99400000-0000-4000-8000-000000000003", Targets: []SessionImpactTarget{{Target: targets[0]}}}
	for range 2 {
		if _, err := s.ApplySessionImpact(ctx, 3, 994, req); err != nil {
			t.Fatal(err)
		}
	}
	var hp int
	if err := pool.QueryRow(ctx, `SELECT (data#>>'{values,hp,current}')::int FROM dndshare."char" WHERE id=9941`).Scan(&hp); err != nil || hp != 33 {
		t.Fatalf("HP=%d err=%v", hp, err)
	}
	if err := pool.QueryRow(ctx, `SELECT data FROM dndshare.session_event WHERE id=$1`, event.ID).Scan(&raw); err != nil {
		t.Fatal(err)
	}
	_ = json.Unmarshal(raw, &root)
	if root["sequence"] == nil || len(array(object(array(object(root["sequence"])["hits"])[0])["impacts"])) != 1 {
		t.Fatal(string(raw))
	}
}
