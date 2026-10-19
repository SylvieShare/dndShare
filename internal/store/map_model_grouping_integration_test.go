package store

import (
	"context"
	"dndshare/internal/battlemap"
	"errors"
	"reflect"
	"testing"
)

func testMapModelGrouping(t *testing.T, ctx context.Context, s *Store) {
	t.Helper()
	var models []battlemap.Model
	for index, id := range []string{"77000000-0000-4000-8000-000000000001", "77000000-0000-4000-8000-000000000002"} {
		m := battlemap.InitialCatalogue()[0]
		m.ID, m.DefinitionID, m.Code, m.VariantCode = id, "", "", ""
		m.SourceCode = []string{"GROUPING-A", "GROUPING-B"}[index]
		m.SourceName = []string{"Grouping A", "Grouping B"}[index]
		if index == 1 {
			m.Code, m.VariantCode = "LC-ground", "LC-ground-straight"
		}
		saved, err := s.RegisterMapModel(ctx, m)
		if err != nil {
			t.Fatal(err)
		}
		models = append(models, saved)
	}
	before, err := s.GetMapModelBehaviour(ctx, models[0].DefinitionID)
	if err != nil {
		t.Fatal(err)
	}
	changes := []ModelGroupingChange{}
	for _, m := range models {
		changes = append(changes, ModelGroupingChange{DefinitionID: m.DefinitionID, ExpectedCode: m.Code, ExpectedVariantCode: m.VariantCode, Code: "LC-ground", VariantCode: "LC-ground-straight"})
	}
	if err := s.UpdateMapModelGrouping(ctx, changes); err != nil {
		t.Fatal(err)
	}
	if err := s.UpdateMapModelGrouping(ctx, changes); err != nil {
		t.Fatal("idempotent retry", err)
	}
	for _, m := range models {
		got, err := s.GetMapModel(ctx, m.ID)
		m.Code, m.VariantCode = "LC-ground", "LC-ground-straight"
		m.GroupName, m.GroupNameEn = "Пол", "Ground"
		if err != nil || !reflect.DeepEqual(got, m) {
			t.Fatal("grouping changed model resources or placement", err)
		}
	}
	after, err := s.GetMapModelBehaviour(ctx, models[0].DefinitionID)
	if err != nil || !reflect.DeepEqual(before, after) {
		t.Fatal("grouping changed behaviour", err)
	}
	bad := append([]ModelGroupingChange(nil), changes...)
	for i := range bad {
		bad[i].ExpectedCode, bad[i].ExpectedVariantCode = "LC-ground", "LC-ground-straight"
		bad[i].Code = "LC-other"
	}
	bad[1].ExpectedVariantCode = "LC-stale"
	if err := s.UpdateMapModelGrouping(ctx, bad); !errors.Is(err, ErrMapModelConflict) {
		t.Fatal("stale grouping accepted", err)
	}
	got, err := s.GetMapModel(ctx, models[0].ID)
	if err != nil || got.Code != "LC-ground" {
		t.Fatal("partial batch committed", err)
	}
	got.Code, got.VariantCode = "LC-ground", "LC-unrelated"
	republished, err := s.RegisterMapModel(ctx, got)
	if err != nil || republished.VariantCode != "LC-ground-straight" {
		t.Fatal("republish overwrote grouping", err)
	}
	republished.VariantCode = "LC-ground-custom"
	edited, err := s.UpdateMapModel(ctx, republished.ID, republished)
	if err != nil || edited.VariantCode != "LC-ground-custom" {
		t.Fatal("admin variant edit", err)
	}
}
