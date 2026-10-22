package store

import (
	"context"
	"dndshare/internal/battlemap"
	"errors"
	"reflect"
	"testing"
)

func testSessionImageMap(t *testing.T, ctx context.Context, s *Store) {
	t.Helper()
	if _, err := s.pool.Exec(ctx, `INSERT INTO dndshare.storage_image(id) VALUES(987)`); err != nil {
		t.Fatal(err)
	}
	d := battlemap.Document{Version: 2, Kind: "image", Width: 30, Height: 20, Image: &battlemap.MapImage{ID: 987, URL: "private-route", PixelWidth: 1500, PixelHeight: 1000, CellPixels: 50}}
	image, err := s.AddSessionMap(ctx, 10, BattleMap{Name: "Пещера", Document: d})
	if err != nil {
		t.Fatal(err)
	}
	if image.Document.Image.URL != "" {
		t.Fatal("persisted a presentation URL")
	}
	image.Document.Image.OffsetX = 1.5
	image.Name = "Новая пещера"
	changed, err := s.SaveSessionMap(ctx, 10, image)
	if err != nil || changed.Document.Image.OffsetX != 1.5 {
		t.Fatal("image edit", err)
	}
	if _, err = s.GetSessionMap(ctx, 20, image.ID); !errors.Is(err, ErrNotFound) {
		t.Fatal("image map escaped session")
	}
	if _, err = s.pool.Exec(ctx, `DELETE FROM dndshare.storage_image WHERE id=987`); err == nil {
		t.Fatal("deleted referenced image")
	}
	if err = s.DeleteSessionMap(ctx, 10, image.ID); err != nil {
		t.Fatal(err)
	}
	if _, err = s.pool.Exec(ctx, `DELETE FROM dndshare.storage_image WHERE id=987`); err != nil {
		t.Fatal(err)
	}
}
func testModelPlacementCells(t *testing.T, ctx context.Context, s *Store) {
	t.Helper()
	m := battlemap.InitialCatalogue()[0]
	m.ID = "00000000-0000-4000-8000-000000000089"
	m.Collection = "cell-test"
	m.Width = 3
	m.Height = 2
	m.PlacementPoints = []battlemap.PlacementPoint{{X: .5, Y: .5, Elevation: m.SurfaceHeight, Cell: &battlemap.GridCell{X: 0, Y: 0}}}
	m, err := s.RegisterMapModel(ctx, m)
	if err != nil {
		t.Fatal(err)
	}
	patch := ModelPlacementCells{DefinitionID: m.DefinitionID, Width: 3, Height: 2, Expected: m.PlacementPoints, Cells: []battlemap.GridCell{{X: 2, Y: 1}}}
	for range 2 {
		if err = s.UpdateMapModelPlacementCells(ctx, []ModelPlacementCells{patch}); err != nil {
			t.Fatal(err)
		}
	}
	after, err := s.GetMapModel(ctx, m.ID)
	if err != nil {
		t.Fatal(err)
	}
	expected := m
	expected.PlacementPoints = append([]battlemap.PlacementPoint{}, m.PlacementPoints...)
	expected.PlacementPoints[0].Cell = &battlemap.GridCell{X: 2, Y: 1}
	if !reflect.DeepEqual(expected, after) {
		t.Fatal("cell patch changed other metadata")
	}
	patch.Cells[0] = battlemap.GridCell{X: 1, Y: 1}
	if err = s.UpdateMapModelPlacementCells(ctx, []ModelPlacementCells{patch}); !errors.Is(err, ErrMapModelConflict) {
		t.Fatal("accepted stale points", err)
	}
	patch.Expected = after.PlacementPoints
	patch.Cells[0] = battlemap.GridCell{X: 3, Y: 1}
	if err = s.UpdateMapModelPlacementCells(ctx, []ModelPlacementCells{patch}); !errors.Is(err, ErrInvalidMapModels) {
		t.Fatal("accepted cell outside footprint", err)
	}
}
