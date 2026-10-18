package store

import (
	"context"
	"dndshare/internal/battlemap"
	"reflect"
	"testing"
)

func testTileTransitionPersistence(t *testing.T, ctx context.Context, s *Store) {
	t.Helper()
	models := []battlemap.Model{}
	for i, id := range []string{"99000000-0000-4000-8000-000000000001", "99000000-0000-4000-8000-000000000002"} {
		model := battlemap.InitialCatalogue()[0]
		model.ID, model.DefinitionID, model.Collection = id, "", "transition-test"
		model.SourceCode = []string{"TR-001", "TR-002"}[i]
		model.Width, model.Height, model.TileType = 1, 1, "floor"
		saved, err := s.RegisterMapModel(ctx, model)
		if err != nil {
			t.Fatal(err)
		}
		models = append(models, saved)
	}
	state := &battlemap.TileTransitions{OriginalModelID: models[0].ID, Targets: []battlemap.TileTransition{{ID: "empty"}, {ID: "target", ModelID: models[1].ID}}}
	document := battlemap.Document{Version: battlemap.DocumentVersion, Kind: "tiles", Width: 8, Height: 8,
		Tiles: []battlemap.Tile{{ID: "switch", ModelID: models[0].ID, X: 1, Y: 1, Transitions: state}}}
	if err := battlemap.ValidateDocument(&document); err != nil {
		t.Fatal(err)
	}
	if _, err := s.MapModelsForDocument(ctx, document); err != nil {
		t.Fatal(err)
	}
	saved, err := s.SaveBattleMap(ctx, 1, BattleMap{Name: "Transitions", Document: document})
	if err != nil {
		t.Fatal(err)
	}
	loaded, err := s.GetBattleMap(ctx, 1, saved.ID)
	if err != nil || !reflect.DeepEqual(loaded.Document.Tiles[0].Transitions, state) {
		t.Fatal("lost map transitions", err)
	}
	var references int
	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM dndshare.battle_map_model WHERE map_id=$1::uuid`, saved.ID).Scan(&references); err != nil || references != 2 {
		t.Fatal("unplaced target reference", references, err)
	}
	if _, err := s.pool.Exec(ctx, `INSERT INTO dndshare.session(id) VALUES(991)`); err != nil {
		t.Fatal(err)
	}
	copy, err := s.AddSessionMap(ctx, 991, saved)
	if err != nil {
		t.Fatal(err)
	}
	copy.Document.Tiles[0].ModelID = models[1].ID
	copy, err = s.SaveSessionMap(ctx, 991, copy)
	if err != nil {
		t.Fatal(err)
	}
	copy, err = s.GetSessionMap(ctx, 991, copy.ID)
	if err != nil || !reflect.DeepEqual(copy.Document.Tiles[0].Transitions, state) {
		t.Fatal("lost session transitions after replacement", err)
	}
	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM dndshare.session_map_model WHERE map_id=$1::uuid`, copy.ID).Scan(&references); err != nil || references != 2 {
		t.Fatal("lost original model reference", references, err)
	}
}
