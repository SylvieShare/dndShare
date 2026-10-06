package store

import (
	"context"
	"errors"
	"os"
	"strings"
	"sync"
	"testing"

	"dndshare/internal/battlemap"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestBattleMapPersistenceAndIsolation(t *testing.T) {
	dsn := os.Getenv("DNDSHARE_MAP_TEST_DSN")
	if dsn == "" {
		t.Skip("set DNDSHARE_MAP_TEST_DSN to a disposable local dndshare_test_* database")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Host != "127.0.0.1" || !strings.HasPrefix(cfg.ConnConfig.Database, "dndshare_test_") {
		t.Fatal("requires isolated local test database")
	}
	cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	ctx := context.Background()
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	exec := func(sql string) {
		t.Helper()
		if _, err := pool.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	exec(`CREATE SCHEMA dndshare; CREATE TABLE dndshare.users(id bigint PRIMARY KEY); CREATE TABLE dndshare.session(id bigint PRIMARY KEY); CREATE TABLE dndshare.storage_image(id bigint PRIMARY KEY); INSERT INTO dndshare.users VALUES(1),(2); INSERT INTO dndshare.session VALUES(10),(20);`)
	defer exec(`DROP SCHEMA dndshare CASCADE`)
	exec(schemaBattleMapsSQL)
	exec(schema3DMapsSQL)
	exec(schemaModelSupportSlotsSQL)
	exec(schemaModelMountDepthSQL)
	exec(schemaModelBaseFootprintsSQL)
	exec(schemaModelTextureDetailSQL)
	exec(schemaModelTileCategoriesSQL)
	exec(schemaModelWallShapesSQL)
	exec(schemaModelSurfacesObjectsSQL)
	exec(schemaMeasuredPlacementPointsSQL)
	exec(schemaMapAreasSQL)
	exec(schemaMapLightingSQL)
	s := &Store{pool: pool}
	preset := battlemap.Presets()[0]
	preset.Document.Areas = []battlemap.Area{{ID: "room", Name: "Вход", Hidden: true, TileIDs: []string{preset.Document.Tiles[0].ID}, ObjectIDs: []string{}}}
	preset.Document.Sun = &battlemap.SunLight{Enabled: false, Angle: 90, Elevation: 30}
	preset.Document.Lights = []battlemap.Light{{ID: "torch", Name: "Факел", Kind: "torch", Color: "#ffc36a", X: 3, Y: 3, Height: .9, Intensity: 8, Radius: 4, Enabled: true, Shadows: true, Offset: [2]float64{}, Anchor: &battlemap.LightAnchor{Kind: "tile", ID: preset.Document.Tiles[0].ID}, AreaID: "room"}}
	m, err := s.SaveBattleMap(ctx, 1, BattleMap{Name: preset.Name, Document: preset.Document})
	if err != nil {
		t.Fatal(err)
	}
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
	if len(b.Document.Areas) != 1 || !b.Document.Areas[0].Hidden || b.Document.Areas[0].Name != "Вход" {
		t.Fatal("area metadata was not copied into session")
	}
	if b.Document.Sun.Enabled || b.Document.Sun.Angle != 90 || len(b.Document.Lights) != 1 || b.Document.Lights[0].Anchor.ID != preset.Document.Tiles[0].ID {
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
			_, err := s.SaveSessionMapState(ctx, 10, a.ID, a.Revision, a.State)
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
}
