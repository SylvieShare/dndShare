package store

import (
	"context"
	"dndshare/internal/battlemap"
	"encoding/json"
	"testing"
)

func testMapModelMerge(t *testing.T, ctx context.Context, s *Store) {
	t.Helper()
	source := battlemap.InitialCatalogue()[0]
	source.ID = "00000000-0000-4000-8000-000000000061"
	source.SourceCode = "MERGE-LIT"
	source.SourceName = "Lit"
	source.DefinitionID = ""
	source.Collection = "merge-test"
	source.TileType = "floor"
	source.Width = 1
	source.Height = 1
	source.SupportSlots = nil
	source.Blockers = nil
	source.WallMode = "none"
	source.WallMask = 0
	var err error
	source, err = s.RegisterMapModel(ctx, source)
	if err != nil {
		t.Fatal(err)
	}
	target := source
	target.ID = "00000000-0000-4000-8000-000000000062"
	target.SourceCode = "MERGE-BASE"
	target.SourceName = "Base"
	target.DefinitionID = ""
	target, err = s.RegisterMapModel(ctx, target)
	if err != nil {
		t.Fatal(err)
	}
	light := battlemap.ModelLight{Key: "torch", Name: "Свет", Kind: "torch", Color: "#ffb04a", Position: [3]float64{.5, .5, 1}, Radius: 4, Intensity: 8, Enabled: true}
	b, _ := s.GetMapModelBehaviour(ctx, source.DefinitionID)
	b.DefaultLights = []battlemap.ModelLight{light}
	if _, err = s.UpdateMapModelBehaviour(ctx, source.DefinitionID, b); err != nil {
		t.Fatal(err)
	}
	b, _ = s.GetMapModelBehaviour(ctx, target.DefinitionID)
	light.FlagKey = "burning"
	b.DefaultLights = []battlemap.ModelLight{light}
	b.DefaultFlags = []battlemap.ModelFlag{{Key: "burning", Name: "Горит", Enabled: false}}
	b.DefaultEffects = []battlemap.ModelEffect{{Key: "fire", Name: "Огонь", Kind: "fire", Color: "#ffb04a", Size: [2]float64{.3, .5}, Strength: .7, Enabled: true, Position: [3]float64{.5, .5, .8}, FlagKey: "burning"}}
	if _, err = s.UpdateMapModelBehaviour(ctx, target.DefinitionID, b); err != nil {
		t.Fatal(err)
	}
	d := battlemap.Document{Version: battlemap.DocumentVersion, Kind: "tiles", Width: 10, Height: 10, Tiles: []battlemap.Tile{{ID: "on", ModelID: source.ID, X: 1, Y: 1}, {ID: "off", ModelID: target.ID, X: 3, Y: 1}}}
	if err = s.PrepareMapDocument(ctx, &d); err != nil {
		t.Fatal(err)
	}
	m, err := s.SaveBattleMap(ctx, 1, BattleMap{Name: "merge control", Document: d})
	if err != nil {
		t.Fatal(err)
	}
	defer s.DeleteBattleMap(ctx, 1, m.ID)
	if _, err = s.pool.Exec(ctx, `INSERT INTO dndshare.session(id) VALUES(9100)`); err != nil {
		t.Fatal(err)
	}
	docRaw, _ := json.Marshal(d)
	play := battlemap.InitialState()
	play.Fog = false
	play.DefaultVisibility = "visible"
	stateRaw, _ := json.Marshal(play)
	var sessionMapID string
	if err = s.pool.QueryRow(ctx, `INSERT INTO dndshare.session_map(session_id,name,document,state) VALUES(9100,'merge session',CAST($1 AS jsonb),CAST($2 AS jsonb)) RETURNING id::text`, json.RawMessage(docRaw), json.RawMessage(stateRaw)).Scan(&sessionMapID); err != nil {
		t.Fatal(err)
	}
	defer s.pool.Exec(ctx, `DELETE FROM dndshare.session_map WHERE id=$1::uuid`, sessionMapID)
	input := MapModelMerge{SourceID: source.ID, TargetID: target.ID, ExpectedSourceLOD: source.Assets["lod"].SHA256, ExpectedTargetLOD: target.Assets["lod"].SHA256, FlagKey: "burning", LightKey: "torch", Name: "Факел"}
	preview, err := s.MergeMapModel(ctx, input)
	if err != nil || preview.Placements != 2 || preview.SessionMaps != 1 || preview.Applied {
		t.Fatal("preview", preview, err)
	}
	unchanged, _ := s.GetBattleMap(ctx, 1, m.ID)
	if unchanged.Document.Tiles[0].ModelID != source.ID || unchanged.Revision != m.Revision {
		t.Fatal("preview wrote data")
	}
	input.Apply = true
	result, err := s.MergeMapModel(ctx, input)
	if err != nil || result.Placements != 2 || result.SessionMaps != 1 || len(result.SessionIDs) != 1 || result.SessionIDs[0] != 9100 || !result.Applied {
		t.Fatal("apply", result, err)
	}
	loaded, err := s.GetBattleMap(ctx, 1, m.ID)
	if err != nil {
		t.Fatal(err)
	}
	if loaded.Revision != m.Revision+1 || loaded.Document.Tiles[0].ID != "on" || loaded.Document.Tiles[0].ModelID != target.ID {
		t.Fatal("lost placement/revision", loaded)
	}
	states := map[string]bool{}
	for _, f := range loaded.Document.Flags {
		states[f.Anchor.ID] = f.Enabled
	}
	if !states["on"] || states["off"] || len(loaded.Document.Effects) != 2 {
		t.Fatal("states/effects", loaded.Document)
	}
	var sessionDocRaw, sessionStateRaw []byte
	if err = s.pool.QueryRow(ctx, `SELECT document,state FROM dndshare.session_map WHERE id=$1::uuid`, sessionMapID).Scan(&sessionDocRaw, &sessionStateRaw); err != nil {
		t.Fatal(err)
	}
	var sessionDoc battlemap.Document
	var sessionState battlemap.State
	if err = json.Unmarshal(sessionDocRaw, &sessionDoc); err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal(sessionStateRaw, &sessionState); err != nil {
		t.Fatal(err)
	}
	if sessionDoc.Tiles[0].ModelID != target.ID || len(sessionDoc.Effects) != 2 || sessionState.Fog || sessionState.DefaultVisibility != "visible" {
		t.Fatal("session state or document changed incorrectly", sessionDoc, sessionState)
	}
	archived, _ := s.GetMapModel(ctx, source.ID)
	base, _ := s.GetMapModel(ctx, target.ID)
	if !archived.Hidden || base.Name != "Факел" {
		t.Fatal("catalogue not consolidated", archived, base)
	}
	var references int
	if err = s.pool.QueryRow(ctx, `SELECT count(*) FROM dndshare.battle_map_model WHERE model_id=$1::uuid`, source.ID).Scan(&references); err != nil || references != 0 {
		t.Fatal("old model references", references, err)
	}
	repeat, err := s.MergeMapModel(ctx, input)
	if err != nil || repeat.Placements != 0 || repeat.Maps != 0 {
		t.Fatal("non-idempotent merge", repeat, err)
	}
	b, err = s.GetMapModelBehaviour(ctx, target.DefinitionID)
	if err != nil {
		t.Fatal(err)
	}
	b.DefaultFlags[0].Enabled = true
	if _, err = s.UpdateMapModelBehaviour(ctx, target.DefinitionID, b); err != nil {
		t.Fatal(err)
	}
	if err = s.HydrateMapLights(ctx, &loaded.Document); err != nil {
		t.Fatal(err)
	}
	for _, f := range loaded.Document.Flags {
		if f.Anchor.ID == "off" && f.Enabled {
			t.Fatal("new default relit an existing unlit torch")
		}
	}
	fresh := battlemap.Document{Version: battlemap.DocumentVersion, Kind: "tiles", Width: 10, Height: 10, Tiles: []battlemap.Tile{{ID: "fresh", ModelID: target.ID, X: 1, Y: 1}}}
	if err = s.PrepareMapDocument(ctx, &fresh); err != nil || !fresh.Flags[0].Enabled {
		t.Fatal("new torch does not follow new default", err)
	}
}
