package store

import (
	"context"
	"errors"
	"reflect"
	"testing"

	"dndshare/internal/battlemap"
)

func testMapModelGroupUpdate(t *testing.T, ctx context.Context, s *Store) {
	t.Helper()
	m := battlemap.InitialCatalogue()[0]
	m.Collection, m.SourceCode, m.SourceName = "majestic-highlands", "MH-GROUP-TEST", "Lit Campfire Group Test"
	m.ID, m.DefinitionID, m.Code = "30000000-0000-4000-8000-000000000091", "", ""
	m, err := s.RegisterMapModel(ctx, m)
	if err != nil {
		t.Fatal(err)
	}
	next := m
	next.ID, next.Version = "30000000-0000-4000-8000-000000000092", 2
	next, err = s.RegisterMapModel(ctx, next)
	if err != nil {
		t.Fatal(err)
	}
	target := m
	target.ID, target.SourceCode, target.SourceName = "30000000-0000-4000-8000-000000000093", "MH-GROUP-TARGET", "Unlit Campfire Group Test"
	target.DefinitionID, target.Code = "", ""
	target, err = s.RegisterMapModel(ctx, target)
	if err != nil {
		t.Fatal(err)
	}
	b, err := s.GetMapModelBehaviour(ctx, m.DefinitionID)
	if err != nil {
		t.Fatal(err)
	}
	b.DefaultLights = []battlemap.ModelLight{{Key: "fire", Name: "Fire", Kind: "torch", Color: "#ffc36a", Position: [3]float64{.5, .5, 1}, Intensity: 8, Radius: 4, Enabled: true}}
	b.Transitions = []battlemap.ModelTransition{{ID: "30000000-0000-4000-8000-000000000094", ToDefinitionID: target.DefinitionID, Action: "extinguish"}}
	b, err = s.UpdateMapModelBehaviour(ctx, m.DefinitionID, b)
	if err != nil {
		t.Fatal(err)
	}
	code := "MH-campfire-group-test"
	if got, err := s.UpdateMapModelGroup(ctx, m.DefinitionID, m.Code, code); err != nil || got != code {
		t.Fatal("group update", got, err)
	}
	for _, before := range []battlemap.Model{m, next} {
		got, err := s.GetMapModel(ctx, before.ID)
		before.Code = code
		if err != nil || !reflect.DeepEqual(got, before) {
			t.Fatal("group update changed immutable resources or placement", err)
		}
	}
	if got, err := s.GetMapModelBehaviour(ctx, m.DefinitionID); err != nil || !reflect.DeepEqual(got, b) {
		t.Fatal("group update changed lights, transitions or behaviour revision", err)
	}
	if _, err := s.UpdateMapModelGroup(ctx, m.DefinitionID, m.Code, code); err != nil {
		t.Fatal("idempotent retry", err)
	}
	if _, err := s.UpdateMapModelGroup(ctx, m.DefinitionID, m.Code, "MH-other"); !errors.Is(err, ErrMapModelConflict) {
		t.Fatal("accepted stale code", err)
	}
	if _, err := s.UpdateMapModelGroup(ctx, m.DefinitionID, code, "UD-campfire"); err == nil {
		t.Fatal("accepted another pack prefix")
	}
	if _, err := s.UpdateMapModelGroup(ctx, "MH-MISSING", code, "MH-other"); !errors.Is(err, ErrNotFound) {
		t.Fatal("missing definition", err)
	}
}
