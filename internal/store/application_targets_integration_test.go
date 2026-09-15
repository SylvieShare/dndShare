package store

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5/pgxpool"
	"testing"
)

func testApplicationTargets(t *testing.T, s *Store, pool *pgxpool.Pool) {
	ctx := context.Background()
	exec := func(sql string) {
		t.Helper()
		if _, err := pool.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	exec(`INSERT INTO dndshare.item(id,type_id,name,data) VALUES(800,10,'Лечение','{"consumption":{"healing":"4"}}'),(801,15,'Эффект','{"stacking":"single"}'),(802,5,'Заклинание','{"status_effects":[{"key":"test","effect":{"id":801},"duration":{"kind":"minutes","value":1},"concentration":true}]}');
 INSERT INTO dndshare."char"(id,user_id,data) VALUES(10,1,'{"values":{"name":"Отправитель","potions":[{"uid":"dose","item_id":800,"count":3}],"spells":{"tabs":[{"spells":[{"id":802}]}]}}}'),(11,2,'{"values":{"name":"Цель","ava":{"url":"/target-avatar.png"},"hp":{"current":0,"max":{"base":8,"bonuses":[{"value":2}]},"temp":3},"states":[{"effect_id":801,"concentration":true}]}}');
 INSERT INTO dndshare.session_participant VALUES(1,10,1),(1,11,2);
 INSERT INTO dndshare.item(id,type_id,name,data,icon_image_id) VALUES(803,6,'Гоблин','{"combat":{"hp":14}}',1);
 INSERT INTO dndshare.session_encounter(session_id,data) VALUES(1,'{"combatants":[{"uid":"npc-a","type":"npc","itemId":803,"markerLetter":"A","iconColor":"#abcdef","override":{"name":"Гоблин","hp":10},"hpCurrent":1,"hpTemp":2}]}');`)
	defer exec(`DELETE FROM dndshare.item_transfer WHERE sender_char_id=10; DELETE FROM dndshare.session_event WHERE actor_char_id=10;DELETE FROM dndshare.session_participant WHERE char_id IN (10,11);DELETE FROM dndshare."char" WHERE id IN(10,11);DELETE FROM dndshare.item WHERE id IN(800,801,802,803);DELETE FROM dndshare.session_encounter;`)
	version := func() int64 {
		var v int64
		_ = pool.QueryRow(ctx, `SELECT version FROM dndshare."char" WHERE id=10`).Scan(&v)
		return v
	}
	offer, err := s.CreatePotionUse(ctx, 1, 1, 10, 0, version(), "dose", "10000000-0000-4000-8000-000000000001")
	if err != nil {
		t.Fatal(err)
	}
	if !offer.AddressedToDM || offer.RecipientName != "Мастер" {
		t.Fatal(offer)
	}
	targets, err := s.SessionApplicationTargets(ctx, 3, 1)
	if err != nil {
		t.Fatal(err)
	}
	var npc ApplicationTarget
	images := map[string]string{}
	for _, target := range targets {
		images[target.Name] = target.ImageURL
		if target.Name == "Цель" && (target.HP == nil || *target.HP != (ApplicationTargetHP{Current: 0, Max: 10, Temp: 3})) {
			t.Fatalf("character HP: %+v", target.HP)
		}
		if target.Kind == "npc" {
			npc = target
		}
	}
	if images["Лиора"] != "/sender.png" || images["Цель"] != "/target-avatar.png" || images["Отправитель"] != "" {
		t.Fatalf("target portraits: %#v", images)
	}
	if npc.ImageURL != "/sender.png" || npc.HP == nil || *npc.HP != (ApplicationTargetHP{Current: 1, Max: 10, Temp: 2}) {
		t.Fatalf("NPC presentation: %+v", npc)
	}
	if npc.Letter != "A" || npc.Color != "#abcdef" || npc.Name != "Гоблин" {
		t.Fatal(npc)
	}
	if _, err = s.ResolveSessionApplication(ctx, 2, 1, offer.EventID, true, npc); !errors.Is(err, ErrNotFound) {
		t.Fatalf("non-DM: %v", err)
	}
	accepted, err := s.ResolveSessionApplication(ctx, 3, 1, offer.EventID, true, npc)
	if err != nil {
		t.Fatal(err)
	}
	again, err := s.ResolveSessionApplication(ctx, 3, 1, offer.EventID, true, npc)
	if err != nil || string(accepted.ApplicationResult) != string(again.ApplicationResult) {
		t.Fatalf("retry: %v", err)
	}
	var encRaw string
	_ = pool.QueryRow(ctx, `SELECT data::text FROM dndshare.session_encounter`).Scan(&encRaw)
	var enc map[string]any
	_ = json.Unmarshal([]byte(encRaw), &enc)
	if number(object(array(enc["combatants"])[0])["hpCurrent"]) != 5 {
		t.Fatal(encRaw)
	}
	if err = s.SaveEncounterData(ctx, 1, "pending", 0, `{"combatants":[]}`); !errors.Is(err, ErrCharacterVersion) {
		t.Fatalf("stale save: %v", err)
	}
	rejected, err := s.CreatePotionUse(ctx, 1, 1, 10, 0, version(), "dose", "10000000-0000-4000-8000-000000000002")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = s.ResolveSessionApplication(ctx, 3, 1, rejected.EventID, false, ApplicationTarget{}); err != nil {
		t.Fatal(err)
	}
	var raw json.RawMessage
	_ = pool.QueryRow(ctx, `SELECT data FROM dndshare."char" WHERE id=10`).Scan(&raw)
	doc, _ := decodeTransferDocument(raw)
	if number(object(array(doc.values()["potions"])[0])["count"]) != 2 {
		t.Fatal(string(raw))
	}
	spell, err := s.CreateSpellApplication(ctx, 1, 1, 10, 11, version(), "802", "10000000-0000-4000-8000-000000000003", "test")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = s.ResolveItemTransfer(ctx, 2, 11, spell.ID, true); err != nil {
		t.Fatal(err)
	}
	_ = pool.QueryRow(ctx, `SELECT data FROM dndshare."char" WHERE id=11`).Scan(&raw)
	doc, _ = decodeTransferDocument(raw)
	states := array(doc.values()["states"])
	if len(states) != 2 || object(states[1])["concentration"] != false || textValue(object(states[1])["concentration_owner"]) == "" {
		t.Fatal(string(raw))
	}
	if _, err = s.CreateSpellApplication(ctx, 1, 1, 10, 11, version(), "803", "10000000-0000-4000-8000-000000000004", "test"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("unowned spell: %v", err)
	}
	t.Run("concentration across targets", func(t *testing.T) { testConcentration(t, s, pool, npc) })
	t.Run("automatic acceptance", func(t *testing.T) { testAutoAccept(t, s, pool) })
}
