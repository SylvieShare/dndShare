package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"testing"
)

func testConcentration(t *testing.T, s *Store, pool *pgxpool.Pool, npc ApplicationTarget) {
	ctx := context.Background()
	exec := func(sql string) {
		t.Helper()
		if _, err := pool.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	version := func() int64 {
		var v int64
		if err := pool.QueryRow(ctx, `SELECT version FROM dndshare."char" WHERE id=10`).Scan(&v); err != nil {
			t.Fatal(err)
		}
		return v
	}
	get := func() *CharacterConcentration {
		t.Helper()
		c, err := s.CharacterConcentration(ctx, 10)
		if err != nil {
			t.Fatal(err)
		}
		return c
	}
	seq := 10
	action := func() string { seq++; return fmt.Sprintf("10000000-0000-4000-8000-%012d", seq) }
	exec(`UPDATE dndshare.item SET data=data||'{"concentration":true}'::jsonb WHERE id=802`)
	c := get()
	if c == nil || c.SpellID != 802 || len(c.Effects) != 1 || c.Effects[0].Target.CharID != 11 {
		t.Fatalf("initial graph: %+v", c)
	}
	castID := c.ID
	a := action()
	oldVersion := version()
	first, err := s.UseSpellSelf(ctx, 1, 10, oldVersion, 802, "test", a)
	if err != nil {
		t.Fatal(err)
	}
	retry, err := s.UseSpellSelf(ctx, 1, 10, oldVersion, 802, "test", a)
	if err != nil || len(first.Effects) != 1 || len(retry.Effects) != 1 {
		t.Fatalf("self retry: %+v %v", retry, err)
	}
	if c = get(); c.ID != castID || len(c.Effects) != 2 {
		t.Fatalf("self + other: %+v", c)
	}
	offer, err := s.CreateSpellApplication(ctx, 1, 1, 10, 0, version(), "802", action(), "test")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = s.ResolveSessionApplication(ctx, 3, 1, offer.EventID, true, npc); err != nil {
		t.Fatal(err)
	}
	if c = get(); c.ID != castID || len(c.Effects) != 3 {
		t.Fatalf("NPC graph: %+v", c)
	}
	pending, err := s.CreateSpellApplication(ctx, 1, 1, 10, 11, version(), "802", action(), "test")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = s.ChangeConcentration(ctx, 2, 10, version(), 0, action(), castID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("nonowner end: %v", err)
	}
	if _, err = s.ChangeConcentration(ctx, 1, 10, version()-1, 0, action(), castID); !errors.Is(err, ErrCharacterVersion) {
		t.Fatalf("stale end: %v", err)
	}
	// An identically named effect from another source survives ending this cast.
	exec(`UPDATE dndshare."char" SET data=jsonb_set(data,'{values,states}',data#>'{values,states}'||'[{"uid":"unrelated","effect_id":801,"source":{"kind":"potion"}}]'::jsonb) WHERE id=11;
 INSERT INTO dndshare.item(id,type_id,name,data) VALUES(804,15,'Вялость','{"duration":{"kind":"rounds","value":1}}');
 UPDATE dndshare.item SET data=data||'{"on_end_effect":{"id":804}}'::jsonb WHERE id=801;`)
	defer exec(`DELETE FROM dndshare.item WHERE id=804`)
	if _, err = s.ChangeConcentration(ctx, 1, 10, version(), 0, action(), castID); err != nil {
		t.Fatal(err)
	}
	if get() != nil {
		t.Fatal("concentration still active")
	}
	if _, err = s.ChangeConcentration(ctx, 1, 10, 0, 0, action(), castID); err != nil {
		t.Fatalf("end retry: %v", err)
	}
	var raw json.RawMessage
	if err = pool.QueryRow(ctx, `SELECT data FROM dndshare."char" WHERE id=11`).Scan(&raw); err != nil {
		t.Fatal(err)
	}
	doc, _ := decodeTransferDocument(raw)
	foundUnrelated, foundEnd := false, false
	for _, v := range array(doc.values()["states"]) {
		state := object(v)
		if textValue(object(state["source"])["concentration_id"]) == castID {
			t.Fatal("external effect survived")
		}
		if state["uid"] == "unrelated" {
			foundUnrelated = true
		}
		if number(state["effect_id"]) == 804 {
			foundEnd = true
		}
	}
	if !foundUnrelated || !foundEnd {
		t.Fatalf("retained states / on-end effect: %s", raw)
	}
	if err = pool.QueryRow(ctx, `SELECT data FROM dndshare.session_encounter WHERE id=$1`, npc.EncounterID).Scan(&raw); err != nil {
		t.Fatal(err)
	}
	var encounter map[string]any
	_ = json.Unmarshal(raw, &encounter)
	states := array(object(array(encounter["combatants"])[0])["effectInstances"])
	if len(states) != 1 || number(object(states[0])["effect_id"]) != 804 {
		t.Fatalf("NPC end: %s", raw)
	}
	if _, err = s.ResolveItemTransfer(ctx, 2, 11, pending.ID, true); err == nil {
		t.Fatal("expired spell offer accepted")
	}
	a = action()
	oldVersion = version()
	current, err := s.ChangeConcentration(ctx, 1, 10, oldVersion, 802, a, "")
	if err != nil || current == nil {
		t.Fatalf("explicit start: %v", err)
	}
	again, err := s.ChangeConcentration(ctx, 1, 10, oldVersion, 802, a, "")
	if err != nil || again.ID != current.ID {
		t.Fatalf("start retry: %v", err)
	}
	if _, err = s.ChangeConcentration(ctx, 1, 10, version(), 0, action(), castID); !errors.Is(err, ErrConcentrationExpired) {
		t.Fatalf("old cast ended new: %v", err)
	}
	if _, err = s.ChangeConcentration(ctx, 1, 10, version(), 0, action(), current.ID); err != nil {
		t.Fatal(err)
	}
}
