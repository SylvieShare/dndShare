package store

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestCanonicalAttackTargets(t *testing.T) {
	available := []ApplicationTarget{
		{Kind: "character", CharUUID: "hero", Name: "Герой", HP: &ApplicationTargetHP{Current: 8}, Snapshot: map[string]any{"secret": true}},
		{Kind: "npc", EncounterID: 1, NPCUID: "goblin", Name: "Гоблин", Letter: "Б"},
	}
	got, err := canonicalAttackTargets([]ApplicationTarget{{Kind: "character", CharUUID: "hero", Name: "Подмена"}, available[1], available[0]}, available)
	if err != nil || len(got) != 2 || got[0].Name != "Герой" || got[0].Snapshot != nil || got[0].HP != nil || got[1].Letter != "Б" {
		t.Fatalf("canonical identities: %+v %v", got, err)
	}
	if _, err := canonicalAttackTargets([]ApplicationTarget{{Kind: "npc", EncounterID: 2, NPCUID: "goblin"}}, available); err == nil {
		t.Fatal("foreign encounter accepted")
	}
	if got, err := canonicalAttackTargets(nil, available); err != nil || got == nil || len(got) != 0 {
		t.Fatal("clearing must return an empty array")
	}
}

func TestSessionAttackMarker(t *testing.T) {
	for _, tc := range []struct {
		data string
		want bool
	}{
		{`{"attackRoll":true,"result":{"parts":[{"kind":"dice","sides":20}]}}`, true},
		{`{"result":{"parts":[{"kind":"dice","sides":20}]}}`, false},
		{`{"attackRoll":true,"damageRoll":true,"result":{"parts":[{"kind":"dice","sides":20}]}}`, false},
		{`{"attackRoll":true,"result":{"parts":[{"kind":"dice","sides":6}]}}`, false},
	} {
		var data map[string]any
		_ = json.Unmarshal([]byte(tc.data), &data)
		if isSessionAttack(data) != tc.want {
			t.Fatalf("wrong attack classification: %s", tc.data)
		}
	}
}

func testSessionAttackTargets(t *testing.T, s *Store, pool *pgxpool.Pool) {
	ctx := context.Background()
	targets, err := s.SessionApplicationTargets(ctx, 3, 1)
	if err != nil || len(targets) < 2 {
		t.Fatalf("targets: %v", err)
	}
	event, err := s.CreateSessionEvent(ctx, 1, 1, nil, nil, nil, "dice_roll", "Атака: Посох", json.RawMessage(`{"result":{"total":18,"parts":[{"kind":"dice","sides":20,"rolls":[18]}]}}`), "public", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Exec(ctx, `DELETE FROM dndshare.session_event WHERE id=$1`, event.ID)
	if _, err = pool.Exec(ctx, schemaSessionAttackTargetsSQL); err != nil {
		t.Fatal(err)
	}
	if _, err = s.SetSessionAttackTargets(ctx, 1, 1, event.ID, targets[:1]); err == nil {
		t.Fatal("player changed targets")
	}
	if _, err = s.SetSessionAttackTargets(ctx, 3, 2, event.ID, nil); err == nil {
		t.Fatal("foreign session event accepted")
	}
	if _, err = s.SetSessionAttackTargets(ctx, 3, 1, event.ID, []ApplicationTarget{{Kind: "character", CharUUID: "missing"}}); err == nil {
		t.Fatal("nonparticipant accepted")
	}
	for range 2 {
		updated, err := s.SetSessionAttackTargets(ctx, 3, 1, event.ID, targets[:2])
		if err != nil {
			t.Fatal(err)
		}
		var data map[string]any
		_ = json.Unmarshal(updated.Data, &data)
		if len(array(data["attackTargets"])) != 2 || number(object(data["result"])["total"]) != 18 {
			t.Fatalf("selection/roll: %s", updated.Data)
		}
	}
	updates, err := s.SessionMutableEventUpdates(ctx, 1, 3, event.ID)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, update := range updates {
		if update.ID == event.ID {
			found = true
		}
	}
	if !found {
		t.Fatal("attack selection missing in DM refresh")
	}
	playerUpdates, err := s.SessionMutableEventUpdates(ctx, 1, 1, event.ID)
	if err != nil {
		t.Fatal(err)
	}
	for _, update := range playerUpdates {
		if update.ID == event.ID {
			t.Fatal("attack leaked into player notifications")
		}
	}
	updated, err := s.SetSessionAttackTargets(ctx, 3, 1, event.ID, nil)
	if err != nil {
		t.Fatal(err)
	}
	var data map[string]any
	_ = json.Unmarshal(updated.Data, &data)
	if len(array(data["attackTargets"])) != 0 {
		t.Fatal("selection not cleared")
	}
	if _, err = pool.Exec(ctx, `UPDATE dndshare.session_event SET data=data-'attackRoll' WHERE id=$1`, event.ID); err != nil {
		t.Fatal(err)
	}
	if _, err = s.SetSessionAttackTargets(ctx, 3, 1, event.ID, targets[:1]); err == nil {
		t.Fatal("nonattack accepted")
	}
}
