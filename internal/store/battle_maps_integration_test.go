package store

import (
	"context"
	"dndshare/internal/testdb"
	"errors"
	"sync"
	"testing"

	"dndshare/internal/battlemap"
)

func TestBattleMapPersistenceAndIsolation(t *testing.T) {
	pool := testdb.Pool(t)
	ctx := context.Background()
	var err error
	exec := func(sql string) {
		t.Helper()
		if _, err := pool.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	exec(`CREATE SCHEMA dndshare; CREATE TABLE dndshare.users(id bigint PRIMARY KEY,login text NOT NULL DEFAULT 'tester'); CREATE TABLE dndshare.session(id bigint PRIMARY KEY); CREATE TABLE dndshare.storage_image(id bigint PRIMARY KEY); INSERT INTO dndshare.users(id) VALUES(1),(2); INSERT INTO dndshare.session VALUES(10),(20);`)
	defer exec(`DROP SCHEMA dndshare CASCADE`)
	exec(testSchemaTables(t, "battle_map", "battle_map_model", "map_subscription", "map_rating", "battle_map_preview", "map_model", "map_model_definition", "map_model_group", "map_model_transition", "session_map", "session_map_model", "session_map_display"))
	s := &Store{pool: pool}
	seedMapModelsForTest(t, s)
	preset := struct {
		Name     string
		Document battlemap.Document
	}{Name: "Тестовая карта", Document: battlemap.Document{Version: battlemap.DocumentVersion, Kind: "tiles", Width: 20, Height: 14, Tags: []string{}, Grid: battlemap.Grid{Visible: true}, Tiles: []battlemap.Tile{{ID: "floor", ModelID: battlemap.InitialModelID("LC-007"), X: 2, Y: 2}}, Objects: []battlemap.Object{}, Areas: []battlemap.Area{}, Sun: battlemap.DefaultSun(), Lights: []battlemap.Light{}}}
	preset.Document.Areas = []battlemap.Area{{ID: "room", Name: "Вход", Color: "#22c55e", Hidden: true, TileIDs: []string{preset.Document.Tiles[0].ID}, ObjectIDs: []string{}}}
	preset.Document.Tags = []string{"подземелье", "лес"}
	preset.Document.LightingEnabled = true
	preset.Document.Sun = &battlemap.SunLight{Enabled: false, Angle: 90, Elevation: 30}
	preset.Document.Lights = []battlemap.Light{{ID: "torch", Name: "Факел", Kind: "torch", Color: "#ffc36a", X: 3, Y: 3, Height: .9, Intensity: 8, Radius: 4, Enabled: true, ShowMarker: true, Shadows: true, Offset: [2]float64{}, Anchor: &battlemap.LightAnchor{Kind: "tile", ID: preset.Document.Tiles[0].ID}, AreaID: "room"}}
	m, err := s.SaveBattleMap(ctx, 1, BattleMap{Name: preset.Name, Document: preset.Document})
	if err != nil {
		t.Fatal(err)
	}
	testMapPreviewPersistence(t, ctx, s, m)
	if _, err := s.GetBattleMap(ctx, 2, m.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("owner isolation: %v", err)
	}
	a, err := s.AddSessionMap(ctx, 10, m)
	if err != nil {
		t.Fatal(err)
	}
	b, err := s.AddSessionMap(ctx, 20, m)
	if err != nil {
		t.Fatal(err)
	}
	if len(b.Document.Tags) != 2 || b.Document.Tags[1] != "лес" {
		t.Fatal("map tags did not survive session copy")
	}
	if len(b.Document.Areas) != 1 || !b.Document.Areas[0].Hidden || b.Document.Areas[0].Name != "Вход" || b.Document.Areas[0].Color != "#22c55e" {
		t.Fatal("area metadata was not copied into session")
	}
	if !b.Document.LightingEnabled || !b.Document.Lights[0].ShowMarker || b.Document.Sun.Enabled || b.Document.Sun.Angle != 90 || len(b.Document.Lights) != 1 || b.Document.Lights[0].Anchor.ID != preset.Document.Tiles[0].ID {
		t.Fatal("lighting metadata was not copied into session")
	}
	m.Document.Tiles[0].Rotation = 90
	if _, err := s.SaveBattleMap(ctx, 1, m); err != nil {
		t.Fatal(err)
	}
	after, err := s.GetSessionMap(ctx, 10, a.ID)
	if err != nil || after.Document.Tiles[0].Rotation == 90 {
		t.Fatal("template edit changed session copy", err)
	}
	if _, err := s.GetSessionMap(ctx, 20, a.ID); !errors.Is(err, ErrNotFound) {
		t.Fatal("session isolation", err)
	}
	a.State.Zones["west"] = "visible"
	var wg sync.WaitGroup
	out := make(chan error, 4)
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := s.SaveSessionMap(ctx, 10, a)
			out <- err
		}()
	}
	wg.Wait()
	close(out)
	winners := 0
	for err := range out {
		if err == nil {
			winners++
		} else if !errors.Is(err, ErrMapConflict) {
			t.Fatal(err)
		}
	}
	if winners != 1 {
		t.Fatalf("concurrent saves succeeded %d times", winners)
	}

	display, err := s.SaveMapDisplay(ctx, 10, MapDisplay{MapID: &a.ID, Visible: true, Camera: battlemap.Camera{CellPixels: 72}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.SaveMapDisplay(ctx, 10, MapDisplay{Revision: display.Revision, MapID: &b.ID, Camera: battlemap.Camera{CellPixels: 72}}); !IsForeignKeyViolation(err) {
		t.Fatal("cross-session display accepted", err)
	}
	if _, err := s.SaveMapDisplay(ctx, 10, MapDisplay{MapID: &a.ID, Camera: battlemap.Camera{CellPixels: 72}}); !errors.Is(err, ErrMapConflict) {
		t.Fatal("stale display accepted", err)
	}
	if err := s.DeleteBattleMap(ctx, 1, m.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := s.GetSessionMap(ctx, 10, a.ID); err != nil {
		t.Fatal("source deletion lost snapshot", err)
	}
	if err := s.DeleteSessionMap(ctx, 10, a.ID); err != nil {
		t.Fatal(err)
	}
	display, err = s.GetMapDisplay(ctx, 10)
	if err != nil || display.Visible || display.MapID != nil {
		t.Fatal("deleting active map did not blackout", err)
	}
	if _, err := s.GetSessionMap(ctx, 20, b.ID); err != nil {
		t.Fatal("other session changed", err)
	}
	testMapCatalogue(t, ctx, s, m)
	testSessionImageMap(t, ctx, s)
}
