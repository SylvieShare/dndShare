package store

import (
	"context"
	"dndshare/internal/battlemap"
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
	exec(schemaSessionMapEditorSQL)
	var preserved bool
	if err := pool.QueryRow(ctx, `SELECT source->>'id'='90000000-0000-4000-8000-000000000190' AND source->>'name'='Seed template' AND source->>'system'='false' AND document->'areas'->0->>'hidden'='true' AND document->>'lightingEnabled'='true' AND document->'sun'->>'angle'='90' AND document->'lights'->0->>'enabled'='false' AND NOT state?'areas' AND NOT state?'lighting' FROM dndshare.session_map WHERE name='Seed template'`).Scan(&preserved); err != nil || !preserved {
		t.Fatal("migration lost source or session presentation", err)
	}
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
