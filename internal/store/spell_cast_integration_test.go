package store

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"testing"
)

func testSpellCast(t *testing.T, s *Store, pool *pgxpool.Pool, npc ApplicationTarget) {
	ctx := context.Background()
	exec := func(sql string) {
		t.Helper()
		if _, err := pool.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	version := func() int64 {
		var v int64
		_ = pool.QueryRow(ctx, `SELECT version FROM dndshare."char" WHERE id=10`).Scan(&v)
		return v
	}
	var sessionUUID, recipientUUID string
	_ = pool.QueryRow(ctx, `SELECT uuid::text FROM dndshare."session" WHERE id=1`).Scan(&sessionUUID)
	_ = pool.QueryRow(ctx, `SELECT uuid::text FROM dndshare."char" WHERE id=11`).Scan(&recipientUUID)
	seq := 200
	id := func() string { seq++; return fmt.Sprintf("20000000-0000-4000-8000-%012d", seq) }
	exec(`UPDATE dndshare.item SET data=data||'{"lvl":1,"application_targets":{"count":3,"per_slot":1}}'::jsonb WHERE id=802;
 UPDATE dndshare.item SET data=data-'on_end_effect' WHERE id=801;
 UPDATE dndshare."char" SET data=jsonb_set(data,'{values,spells}','{"tabs":[{"casting_ability":4,"spells":[{"key":"spell","id":802}]}],"slot_pools":{"long_rest":[{"level":1,"total":1,"used":0},{"level":3,"total":2,"used":0}]}}') WHERE id=10;`)
	req := SpellCastRequest{SpellID: 802, EntryKey: "spell", OptionKey: "test", Version: version(), ClientActionID: id(), SessionUUID: sessionUUID, CastLevel: 1, Pool: "long_rest", SpendSlot: true, Targets: []string{"self", recipientUUID}, DMCount: 1}
	exec(`UPDATE dndshare.item SET data=jsonb_set(data,'{application_targets,self_only}','true') WHERE id=802`)
	if _, err := s.CastSpell(ctx, 1, 10, req); err == nil {
		t.Fatal("self-only spell accepted other targets")
	}
	exec(`UPDATE dndshare.item SET data=data #- '{application_targets,self_only}' WHERE id=802`)
	result, err := s.CastSpell(ctx, 1, 10, req)
	if err != nil {
		t.Fatal(err)
	}
	if result.Self == nil || len(result.Transfers) != 2 {
		t.Fatalf("targets: %+v", result)
	}
	var used int
	_ = pool.QueryRow(ctx, `SELECT (data#>>'{values,spells,slot_pools,long_rest,0,used}')::int FROM dndshare."char" WHERE id=10`).Scan(&used)
	if used != 1 {
		t.Fatalf("slot charged %d times", used)
	}
	again, err := s.CastSpell(ctx, 1, 10, req)
	if err != nil || len(again.Transfers) != 2 || again.Transfers[0].ID != result.Transfers[0].ID {
		t.Fatalf("repeat cast: %+v %v", again, err)
	}
	changed := req
	changed.DMCount = 0
	if _, err = s.CastSpell(ctx, 1, 10, changed); err == nil {
		t.Fatal("changed retry accepted")
	}
	for _, offer := range result.Transfers {
		if offer.AddressedToDM {
			if _, err = s.ResolveSessionApplication(ctx, 3, 1, offer.EventID, true, ApplicationTarget{Kind: "character", CharUUID: recipientUUID}); err == nil {
				t.Fatal("DM selected duplicate target")
			}
		}
	}
	for _, offer := range result.Transfers {
		if offer.AddressedToDM {
			_, err = s.ResolveSessionApplication(ctx, 3, 1, offer.EventID, true, npc)
		} else {
			_, err = s.ResolveItemTransfer(ctx, 2, 11, offer.ID, true)
		}
		if err != nil {
			t.Fatal(err)
		}
	}
	concentration, err := s.CharacterConcentration(ctx, 10)
	if err != nil || len(concentration.Effects) != 3 {
		t.Fatalf("shared concentration: %+v %v", concentration, err)
	}
	invalid := req
	invalid.Version = version()
	invalid.ClientActionID = id()
	invalid.CastLevel = 2
	if _, err = s.CastSpell(ctx, 1, 10, invalid); err == nil {
		t.Fatal("missing middle slot accepted")
	}
	invalid.CastLevel = 3
	invalid.Targets = []string{recipientUUID, recipientUUID}
	if _, err = s.CastSpell(ctx, 1, 10, invalid); err == nil {
		t.Fatal("duplicate target accepted")
	}
	invalid.Targets = []string{"self"}
	invalid.DMCount = 9
	if _, err = s.CastSpell(ctx, 1, 10, invalid); err == nil {
		t.Fatal("too many targets accepted")
	}
	invalid.DMCount = 1
	invalid.Targets = []string{"30000000-0000-4000-8000-000000000099"}
	if _, err = s.CastSpell(ctx, 1, 10, invalid); err == nil {
		t.Fatal("missing target accepted")
	}
	_ = pool.QueryRow(ctx, `SELECT (data#>>'{values,spells,slot_pools,long_rest,1,used}')::int FROM dndshare."char" WHERE id=10`).Scan(&used)
	if used != 0 {
		t.Fatal("failed cast spent a slot")
	}
	exec(`UPDATE dndshare.item SET data='{"lvl":1,"application_targets":{"count":3},"heal":{"dices":[{"count":1,"dice_id":"d4"}],"addon":[{"count":1,"dice_id":"d4"}],"add_mod":true,"scaling":"slot"}}' WHERE id=802;
 UPDATE dndshare."char" SET data=jsonb_set(data,'{values,INT}','{"value":{"base":16,"bonuses":[]}}') WHERE id=10;
 UPDATE dndshare."char" SET data=jsonb_set(data,'{values,hp}','{"current":0,"max":100}') WHERE id IN (10,11);`)
	heal := req
	heal.ClientActionID = id()
	heal.Version = version()
	heal.OptionKey = ""
	heal.CastLevel = 3
	heal.DMCount = 0
	result, err = s.CastSpell(ctx, 1, 10, heal)
	if err != nil {
		t.Fatal(err)
	}
	if result.Self.Healing == nil || len(result.Self.Healing.Dice) != 3 {
		t.Fatalf("upcast: %+v", result.Self)
	}
	accepted, err := s.ResolveItemTransfer(ctx, 2, 11, result.Transfers[0].ID, true)
	if err != nil {
		t.Fatal(err)
	}
	var application ApplicationResult
	_ = json.Unmarshal(accepted.ApplicationResult, &application)
	if application.Healing.Total != result.Self.Healing.Total {
		t.Fatal("targets rolled different healing")
	}
	if application.Healing.Total < 6 || application.Healing.Total > 15 {
		t.Fatalf("ability modifier missing: %+v", application.Healing)
	}
}
