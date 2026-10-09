package store

import (
	"context"
	"crypto/sha256"
	"dndshare/internal/battlemap"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"testing"
)

func testSessionMapEditorMigration(t *testing.T, ctx context.Context, pool *pgxpool.Pool) {
	t.Helper()
	exec := func(sql string) {
		t.Helper()
		if _, err := pool.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	exec(`INSERT INTO dndshare.battle_map(id,owner_user_id,name,document) VALUES('90000000-0000-4000-8000-000000000190',1,'Seed template','{"kind":"tiles","version":2,"areas":[{"id":"room","hidden":false}],"lightingEnabled":false,"sun":{"enabled":false,"angle":10,"elevation":30},"lights":[{"id":"torch","enabled":true}],"tiles":[],"objects":[]}');
 INSERT INTO dndshare.session_map(id,session_id,name,document,state)
 SELECT '90000000-0000-4000-8000-000000000191',10,name,document,'{"fog":false,"tokens":[],"areas":{"room":false},"lighting":{"enabled":true,"sun":{"enabled":true,"angle":90,"elevation":42},"lights":{"torch":false}}}' FROM dndshare.battle_map WHERE name='Seed template';`)
	modelID := battlemap.InitialModelID("LC-007")
	builtinID := fmt.Sprintf("builtin-%x", sha256.Sum256([]byte("tile:legacy-floor:flame")))[:39]
	exec(`UPDATE dndshare.map_model_definition SET default_lights='[{"key":"flame","name":"Builtin torch","kind":"torch","color":"#ffc36a","position":[0.5,0.5,0.8],"intensity":8,"radius":4,"enabled":true,"flicker":true}]' WHERE id=(SELECT definition_id FROM dndshare.map_model WHERE id='` + modelID + `');
 UPDATE dndshare.session_map SET document=document||'{"width":8,"height":8,"tiles":[{"id":"legacy-floor","modelId":"` + modelID + `","x":1,"y":1,"level":0,"rotation":0}]}'::jsonb,state=jsonb_set(state,'{lighting,lights}',(state->'lighting'->'lights')||'{"` + builtinID + `":false}'::jsonb) WHERE name='Seed template';
 UPDATE dndshare.battle_map SET document=(SELECT document FROM dndshare.session_map WHERE name='Seed template') WHERE name='Seed template';`)
	exec(schemaSessionMapEditorSQL)
	var preserved bool
	if err := pool.QueryRow(ctx, `SELECT source->>'id'='90000000-0000-4000-8000-000000000190' AND source->>'name'='Seed template' AND source->>'system'='false' AND document->'areas'->0->>'hidden'='true' AND document->>'lightingEnabled'='true' AND document->'sun'->>'angle'='90' AND document->'lights'->0->>'enabled'='false' AND NOT state?'areas' AND NOT state?'lighting' FROM dndshare.session_map WHERE name='Seed template'`).Scan(&preserved); err != nil || !preserved {
		t.Fatal("migration lost source or session presentation", err)
	}
	var disabled bool
	if err := pool.QueryRow(ctx, `SELECT NOT (l->>'enabled')::boolean FROM dndshare.session_map s CROSS JOIN LATERAL jsonb_array_elements(document->'lights') l WHERE s.name='Seed template' AND l->>'id'=$1`, builtinID).Scan(&disabled); err != nil || !disabled {
		t.Fatal("virtual builtin activation lost", err)
	}
	scene, err := (&Store{pool: pool}).GetSessionMap(ctx, 10, "90000000-0000-4000-8000-000000000191")
	if err != nil {
		t.Fatal(err)
	}
	if err = (&Store{pool: pool}).HydrateSessionMapLights(ctx, &scene); err != nil {
		t.Fatal(err)
	}
	for _, light := range scene.Document.Lights {
		if light.ID == builtinID && (light.Enabled || light.X != 1.5 || light.Y != 1.5 || light.Name != "Builtin torch") {
			t.Fatal("hydration changed activation or failed to restore position", light)
		}
	}
	exec(`UPDATE dndshare.map_model_definition SET default_lights='[]' WHERE id=(SELECT definition_id FROM dndshare.map_model WHERE id='` + modelID + `')`)
	exec(`DELETE FROM dndshare.session_map WHERE name='Seed template';DELETE FROM dndshare.battle_map WHERE name='Seed template'`)
}
func testSessionSceneEdits(t *testing.T, ctx context.Context, s *Store, id string, source BattleMap) {
	t.Helper()
	m, err := s.GetSessionMap(ctx, 10, id)
	if err != nil {
		t.Fatal(err)
	}
	m.Name = "Session arrangement"
	m.Document.Tiles[0].Rotation = 180
	m.Document.Areas[0].Hidden = false
	m.Document.Tiles = append(m.Document.Tiles, battlemap.Tile{ID: "session-extra", ModelID: battlemap.InitialModelID("LC-009"), X: 0, Y: 0})
	m.State.Tokens = []battlemap.Token{{ID: "hero", Kind: "player", Ref: "41", Name: "Hero", Color: "#a797d4", X: 1.5, Y: 1.5, Size: 1}}
	saved, err := s.SaveSessionMap(ctx, 10, m)
	if err != nil {
		t.Fatal(err)
	}
	loaded, err := s.GetSessionMap(ctx, 10, id)
	if err != nil || loaded.Name != m.Name || loaded.Document.Tiles[0].Rotation != 180 || loaded.Document.Areas[0].Hidden || len(loaded.State.Tokens) != 1 || loaded.Revision != saved.Revision {
		t.Fatal("scene edit readback", err)
	}
	if loaded.Source.ID != source.ID || loaded.Source.Name != source.Name {
		t.Fatal("scene edits replaced source identity")
	}
	var linked bool
	if err = s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM dndshare.session_map_model WHERE map_id=$1::uuid AND model_id=$2::uuid)`, id, battlemap.InitialModelID("LC-009")).Scan(&linked); err != nil || !linked {
		t.Fatal("new model FK missing", err)
	}
	template, err := s.GetBattleMap(ctx, 1, source.ID)
	if err != nil || template.Name == m.Name || template.Document.Tiles[0].Rotation == 180 {
		t.Fatal("session edited template", err)
	}
}
