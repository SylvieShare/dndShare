package store

import (
	"context"
	"dndshare/internal/battlemap"
	"errors"
	"testing"
)

func testMapModelBehaviours(t *testing.T, ctx context.Context, s *Store) {
	t.Helper()
	source := battlemap.InitialCatalogue()[0]
	source.Collection = "behaviour-test"
	source.SourceCode = "B-001"
	source.ID = "00000000-0000-4000-8000-000000000020"
	source, err := s.RegisterMapModel(ctx, source)
	if err != nil {
		t.Fatal(err)
	}
	if source.DefinitionID != "B-001" {
		t.Fatal("expected human-readable stable ID", source.DefinitionID)
	}
	target := source
	target.ID = "00000000-0000-4000-8000-000000000021"
	target.SourceCode = "OPEN"
	target.SourceName = "Open variant"
	target.DefinitionID = ""
	target, err = s.RegisterMapModel(ctx, target)
	if err != nil {
		t.Fatal(err)
	}
	other := target
	other.ID = "00000000-0000-4000-8000-000000000024"
	other.SourceName = "Other variant"
	other, err = s.RegisterMapModel(ctx, other)
	if err != nil {
		t.Fatal(err)
	}
	if other.DefinitionID == target.DefinitionID {
		t.Fatal("same-code variants were merged")
	}
	b := battlemap.ModelBehaviour{Revision: 1, DefaultLights: []battlemap.ModelLight{{Key: "flame", Name: "Факел", Kind: "torch", Color: "#ffc36a", Position: [3]float64{.5, .5, 1}, Intensity: 8, Radius: 4, Enabled: true}}, Transitions: []battlemap.ModelTransition{{ID: "00000000-0000-4000-8000-000000000025", ToDefinitionID: target.DefinitionID, Action: "open"}}}
	b.WaterAnimation = &battlemap.WaterAnimation{Enabled: true, Speed: 1, Strength: .7}
	edit := source
	edit.Code = "BEH-door"
	edit.ID = "00000000-0000-4000-8000-000000000022"
	saved, err := s.UpdateMapModelWithBehaviour(ctx, source.ID, edit, &b)
	if err != nil {
		t.Fatal(err)
	}
	if saved.DefinitionID != source.DefinitionID {
		t.Fatal("metadata revision changed logical identity")
	}
	oldCode, err := s.GetMapModel(ctx, source.ID)
	if err != nil || oldCode.Code != "BEH-door" || saved.Code != "BEH-door" {
		t.Fatal("group code did not apply to all versions", err)
	}

	behaviours, err := s.MapModelBehaviours(ctx)
	if err != nil {
		t.Fatal(err)
	}
	loaded := behaviours[source.DefinitionID]
	if loaded.WaterAnimation == nil || *loaded.WaterAnimation != *b.WaterAnimation {
		t.Fatal("water settings lost on metadata save", loaded)
	}
	if loaded.Revision != 2 || len(loaded.DefaultLights) != 1 || len(loaded.Transitions) != 1 || loaded.Transitions[0].ToDefinitionID != target.DefinitionID {
		t.Fatal("behaviour readback", loaded)
	}
	if len(behaviours[target.DefinitionID].Transitions) != 0 {
		t.Fatal("implicitly created reverse transition")
	}
	d := battlemap.Document{Kind: "tiles", Version: battlemap.DocumentVersion, Width: 10, Height: 10, Tiles: []battlemap.Tile{{ID: "torch", ModelID: saved.ID, X: 2, Y: 2}}}
	if err := s.HydrateMapLights(ctx, &d); err != nil {
		t.Fatal(err)
	}
	lightID := d.Lights[0].ID
	d.Lights[0].Enabled = false
	if err := s.HydrateMapLights(ctx, &d); err != nil {
		t.Fatal(err)
	}
	if d.Lights[0].ID != lightID || d.Lights[0].Enabled {
		t.Fatal("read hydration lost instance state")
	}
	intensity, height, marker, flicker, shadows := 17.0, 2.4, true, false, true
	d.Lights[0].Overrides = &battlemap.LightOverrides{Intensity: &intensity, Height: &height, ShowMarker: &marker, Flicker: &flicker, Shadows: &shadows}
	persisted, err := s.SaveBattleMap(ctx, 1, BattleMap{Name: "builtin overrides", Document: d})
	if err != nil {
		t.Fatal(err)
	}
	defer s.DeleteBattleMap(ctx, 1, persisted.ID)
	readback, err := s.GetBattleMap(ctx, 1, persisted.ID)
	if err != nil {
		t.Fatal(err)
	}
	if err := s.HydrateMapLights(ctx, &readback.Document); err != nil {
		t.Fatal(err)
	}
	light := readback.Document.Lights[0]
	if light.ID != lightID || light.Enabled || light.Intensity != intensity || light.Height != height || !light.ShowMarker || light.Flicker || !light.Shadows || light.Overrides == nil || light.Overrides.Flicker == nil || *light.Overrides.Flicker {
		t.Fatal("JSONB read hydration lost explicit light overrides", light)
	}
	copyDoc := battlemap.Document{Width: 10, Height: 10, Tiles: d.Tiles}
	if err := s.HydrateMapLights(ctx, &copyDoc); err != nil || copyDoc.Lights[0].ID != lightID {
		t.Fatal("read source IDs are not deterministic", err)
	}
	edit.ID = "00000000-0000-4000-8000-000000000023"
	if _, err = s.UpdateMapModelWithBehaviour(ctx, saved.ID, edit, &b); !errors.Is(err, ErrMapModelConflict) {
		t.Fatal("stale behaviour edit accepted", err)
	}
	if _, err = s.GetMapModel(ctx, edit.ID); !errors.Is(err, ErrNotFound) {
		t.Fatal("atomic rollback left orphan metadata revision", err)
	}
	b.Revision = 2
	b.Transitions[0].ToDefinitionID = source.DefinitionID
	if _, err = s.UpdateMapModelWithBehaviour(ctx, saved.ID, edit, &b); !errors.Is(err, ErrInvalidMapModels) {
		t.Fatal("self transition accepted", err)
	}
	current, err := s.GetMapModelBehaviour(ctx, source.DefinitionID)
	if err != nil {
		t.Fatal(err)
	}
	current.DefaultLights[0].Intensity = 12
	current.WaterAnimation.Speed = 1.5
	updated, err := s.UpdateMapModelBehaviour(ctx, source.DefinitionID, current)
	if err != nil || updated.Revision != 3 || len(updated.Transitions) != 1 {
		t.Fatal("standalone behaviour update", updated, err)
	}
	unchanged, err := s.GetMapModel(ctx, saved.ID)
	if err != nil || unchanged.ID != saved.ID || unchanged.Assets["render"] != saved.Assets["render"] {
		t.Fatal("behaviour revised immutable resources", err)
	}
	if _, err = s.UpdateMapModelBehaviour(ctx, source.DefinitionID, current); !errors.Is(err, ErrMapModelConflict) {
		t.Fatal("stale standalone update accepted", err)
	}
	current = updated
	current.Transitions[0].ToDefinitionID = source.DefinitionID
	if _, err = s.UpdateMapModelBehaviour(ctx, source.DefinitionID, current); !errors.Is(err, ErrInvalidMapModels) {
		t.Fatal("invalid standalone transition accepted", err)
	}
	after, err := s.GetMapModelBehaviour(ctx, source.DefinitionID)
	if err == nil && (after.WaterAnimation == nil || after.WaterAnimation.Speed != 1.5) {
		t.Fatal("water settings lost on behaviour update", after)
	}
	if err != nil || after.Revision != 3 || after.DefaultLights[0].Intensity != 12 || after.Transitions[0].ToDefinitionID != target.DefinitionID {
		t.Fatal("rollback lost previous behaviour", after, err)
	}

}
