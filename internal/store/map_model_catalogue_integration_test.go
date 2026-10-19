package store

import (
	"context"
	"errors"
	"reflect"
	"testing"
)

func testMapModelCatalogue(t *testing.T, ctx context.Context, s *Store) {
	t.Helper()
	models, err := s.ListMapModels(ctx)
	if err != nil {
		t.Fatal(err)
	}
	m := models[0]
	before, err := s.GetMapModelBehaviour(ctx, m.DefinitionID)
	if err != nil {
		t.Fatal(err)
	}
	change := ModelCatalogueChange{DefinitionID: m.DefinitionID, Expected: ModelCatalogueValue{Name: m.Name, NameEn: m.NameEn, Category: m.Category, Code: m.Code}, ModelCatalogueValue: ModelCatalogueValue{Name: "Поворот реки", NameEn: "River angle", Category: "water", Code: m.Code}}
	group := ModelGroupNames{Collection: m.Collection, Code: m.Code, Name: "Реки", NameEn: "Rivers", ExpectedName: m.GroupName, ExpectedNameEn: m.GroupNameEn}
	if err = s.UpdateMapModelCatalogue(ctx, []ModelCatalogueChange{change}, []ModelGroupNames{group}); err != nil {
		t.Fatal(err)
	}
	if err = s.UpdateMapModelCatalogue(ctx, []ModelCatalogueChange{change}, []ModelGroupNames{group}); err != nil {
		t.Fatal("idempotent retry", err)
	}
	loaded, err := s.GetMapModel(ctx, m.ID)
	want := m
	want.Name, want.NameEn, want.Category, want.GroupName, want.GroupNameEn = change.Name, change.NameEn, change.Category, group.Name, group.NameEn
	if err != nil || !reflect.DeepEqual(loaded, want) {
		t.Fatal("catalogue patch changed resources", err)
	}
	after, err := s.GetMapModelBehaviour(ctx, m.DefinitionID)
	if err != nil || !reflect.DeepEqual(before, after) {
		t.Fatal("catalogue patch changed behaviour", err)
	}
	// A stale group rename must also roll back preceding model changes.
	change.Expected = change.ModelCatalogueValue
	change.Name = "Нельзя сохранить"
	group.ExpectedName = "Устарело"
	group.Name = "Другое имя"
	if err = s.UpdateMapModelCatalogue(ctx, []ModelCatalogueChange{change}, []ModelGroupNames{group}); !errors.Is(err, ErrMapModelConflict) {
		t.Fatal("stale group accepted", err)
	}
	loaded, err = s.GetMapModel(ctx, m.ID)
	if err != nil || loaded.Name != want.Name {
		t.Fatal("partial catalogue committed", err)
	}
	// Processing a new GLB must retain reviewed translations and classification.
	m.Name, m.NameEn, m.Category = "Old recipe", "Old name", "floor"
	loaded, err = s.RegisterMapModel(ctx, m)
	if err != nil || loaded.Name != want.Name || loaded.NameEn != want.NameEn || loaded.Category != want.Category {
		t.Fatal("publication erased catalogue metadata", err)
	}
}
