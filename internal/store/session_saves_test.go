package store

import (
	"context"
	"encoding/json"
	"github.com/jackc/pgx/v5/pgxpool"
	"testing"
)

func testSessionSaves(t *testing.T, s *Store, pool *pgxpool.Pool) {
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `INSERT INTO dndshare.item(id,name,type_id,icon_image_id) VALUES(990001,'Источник',5,1),(990002,'Эффект',15,NULL);`); err != nil {
		t.Fatal(err)
	}
	defer pool.Exec(ctx, `DELETE FROM dndshare.item WHERE id IN (990001,990002)`)
	if err := s.ReuseSystemItemIcon(ctx, 990002, 990001); err != nil {
		t.Fatal(err)
	}
	var icon int64
	if err := pool.QueryRow(ctx, `SELECT icon_image_id FROM dndshare.item WHERE id=990002`).Scan(&icon); err != nil || icon != 1 {
		t.Fatalf("shared icon %d %v", icon, err)
	}
	if err := s.ReuseSystemItemIcon(ctx, 990002, 0); err == nil {
		t.Fatal("missing source accepted")
	}

	targets, err := s.SessionSaveTargets(ctx, 3, 1)
	if err != nil || len(targets) < 2 || targets[0].Snapshot == nil {
		t.Fatalf("snapshots: %+v %v", targets, err)
	}
	if _, err := s.SessionSaveTargets(ctx, 1, 1); err == nil {
		t.Fatal("player accessed DM snapshots")
	}
	event, err := s.CreateSessionEvent(ctx, 1, 1, nil, nil, nil, "spell_used", "Спасбросок", json.RawMessage(`{"savingThrow":{"ability":2,"dc":15,"results":[]}}`), "public", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Exec(ctx, `DELETE FROM dndshare.session_event WHERE id=$1`, event.ID)
	rows := []SessionSaveResult{{Target: targets[0], Result: json.RawMessage(`{"total":15,"parts":[{"kind":"dice","sides":20,"rolls":[15],"sum":15}]}`)}}
	rows[0].Target.Name = "Подмена имени"
	if _, err := s.AppendSessionSaves(ctx, 1, 1, event.ID, rows); err == nil {
		t.Fatal("player wrote DM saves")
	}
	result, err := s.AppendSessionSaves(ctx, 3, 1, event.ID, rows)
	if err != nil {
		t.Fatal(err)
	}
	var data map[string]any
	_ = json.Unmarshal(result.Data, &data)
	saved := array(object(data["savingThrow"])["results"])
	if len(saved) != 1 || object(saved[0])["success"] != true || object(object(saved[0])["target"])["name"] == "Подмена имени" {
		t.Fatalf("result: %s", result.Data)
	}
	result, err = s.AppendSessionSaves(ctx, 3, 1, event.ID, rows)
	if err != nil {
		t.Fatal(err)
	}
	_ = json.Unmarshal(result.Data, &data)
	if len(array(object(data["savingThrow"])["results"])) != 1 {
		t.Fatal("retry appended another roll")
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
		t.Fatal("roll not returned by mutable event refresh")
	}
	rows[0].Target.CharUUID = "00000000-0000-4000-8000-000000000099"
	if _, err := s.AppendSessionSaves(ctx, 3, 1, event.ID, rows); err == nil {
		t.Fatal("nonparticipant accepted")
	}
}

func TestSpellSaveEvent(t *testing.T) {
	values := map[string]any{"stats": map[string]any{"4": 4}, "lvl": map[string]any{"level": 5}, "spells": map[string]any{"tabs": []any{map[string]any{"save_bonus": 1, "spells": []any{map[string]any{"id": 924, "key": "fireball"}}}}}}
	save := spellSaveEvent(map[string]any{"damage": map[string]any{"save_ability": "dex", "save_effect": "half"}}, values, 4, 924, "fireball")
	if save["ability"] != 2 || save["dc"] != 16 || save["onSuccess"] != "half" {
		t.Fatalf("%+v", save)
	}
	if spellSaveEvent(map[string]any{}, values, 4, 924, "") != nil {
		t.Fatal("non-save spell")
	}
}
