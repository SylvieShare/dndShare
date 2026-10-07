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
	exec(schemaModelShadowAssetsSQL)
	exec(schemaModelFurnishingsSQL)
	exec(schemaModelBehaviourSQL)
	exec(schemaModelGroupCodesSQL)
	exec(schemaMapAreasSQL)
	exec(schemaMapLightingSQL)
	exec(schemaMapLightingModeSQL)
	exec(`INSERT INTO dndshare.battle_map(owner_user_id,name,document) VALUES
(1,'legacy image','{"kind":"image","version":2}'),
(1,'legacy grid','{"kind":"image-grid","version":2}'),
(1,'kept 3d','{"kind":"tiles","version":2,"tags":["лес"],"grid":{"visible":true,"offsetX":0,"offsetY":0},"background":{},"credit":{}}');
INSERT INTO dndshare.session_map(session_id,name,document,state) VALUES
(10,'legacy session','{"kind":"image-grid","version":2}','{}'),
(20,'kept session','{"kind":"tiles","version":2,"tags":null,"grid":{"visible":true},"background":{}}','{}');
INSERT INTO dndshare.session_map_display(session_id,map_id,visible)
SELECT 10,id,true FROM dndshare.session_map WHERE name='legacy session';`)
	exec(schema3DMapTagsSQL)
	var remaining, active, tags int
	if err := pool.QueryRow(ctx, `SELECT (SELECT count(*) FROM dndshare.battle_map),(SELECT count(*) FROM dndshare.session_map_display WHERE visible OR map_id IS NOT NULL),jsonb_array_length(document->'tags') FROM dndshare.session_map WHERE name='kept session'`).Scan(&remaining, &active, &tags); err != nil || remaining != 1 || active != 0 || tags != 0 {
		t.Fatal("3d-only cleanup damaged data or retained images", err, remaining, active, tags)
	}
	var clean bool
	if err := pool.QueryRow(ctx, `SELECT document->'tags'='["лес"]'::jsonb AND NOT document ? 'background' AND NOT document ? 'credit' AND NOT (document->'grid') ? 'offsetX' FROM dndshare.battle_map WHERE name='kept 3d'`).Scan(&clean); err != nil || !clean {
		t.Fatal("3d metadata was not migrated", err)
	}
	exec("DELETE FROM dndshare.battle_map WHERE name='kept 3d'; DELETE FROM dndshare.session_map WHERE name='kept session'; DELETE FROM dndshare.session_map_display WHERE session_id=10")
	s := &Store{pool: pool}
	preset := battlemap.Presets()[0]
	preset.Document.Areas = []battlemap.Area{{ID: "room", Name: "Вход", Color: "#22c55e", Hidden: true, TileIDs: []string{preset.Document.Tiles[0].ID}, ObjectIDs: []string{}}}
	preset.Document.Tags = []string{"подземелье", "лес"}
	preset.Document.LightingEnabled = true
	preset.Document.Sun = &battlemap.SunLight{Enabled: false, Angle: 90, Elevation: 30}
	preset.Document.Lights = []battlemap.Light{{ID: "torch", Name: "Факел", Kind: "torch", Color: "#ffc36a", X: 3, Y: 3, Height: .9, Intensity: 8, Radius: 4, Enabled: true, ShowMarker: true, Shadows: true, Offset: [2]float64{}, Anchor: &battlemap.LightAnchor{Kind: "tile", ID: preset.Document.Tiles[0].ID}, AreaID: "room"}}
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
	if len(b.Document.Tags) != 2 || b.Document.Tags[1] != "лес" {
		t.Fatal("map tags did not survive session copy")
	}
	if len(b.Document.Areas) != 1 || !b.Document.Areas[0].Hidden || b.Document.Areas[0].Name != "Вход" || b.Document.Areas[0].Color != "#22c55e" {
		t.Fatal("area metadata was not copied into session")
	}
	if !b.Document.LightingEnabled || !b.Document.Lights[0].ShowMarker || b.Document.Sun.Enabled || b.Document.Sun.Angle != 90 || len(b.Document.Lights) != 1 || b.Document.Lights[0].Anchor.ID != preset.Document.Tiles[0].ID {
		t.Fatal("lighting metadata was not copied into session")
	}
	exec("UPDATE dndshare.battle_map SET document = jsonb_set(document, '{areas,0}', (document->'areas'->0) - 'color')")
	exec("UPDATE dndshare.session_map SET document = jsonb_set(document, '{areas,0}', (document->'areas'->0) - 'color') WHERE session_id=10")
	exec(schemaMapAreaColorsSQL)
	legacyMap, err := s.GetBattleMap(ctx, 1, m.ID)
	if err != nil || legacyMap.Document.Areas[0].Color != battlemap.DefaultAreaColor || legacyMap.Document.Areas[0].Name != "Вход" || legacyMap.Revision != m.Revision {
		t.Fatal("area color migration damaged template", err)
	}
	legacySession, err := s.GetSessionMap(ctx, 10, a.ID)
	if err != nil || legacySession.Document.Areas[0].Color != battlemap.DefaultAreaColor || !legacySession.Document.Areas[0].Hidden {
		t.Fatal("area color migration damaged session", err)
	}
	coloredSession, err := s.GetSessionMap(ctx, 20, b.ID)
	if err != nil || coloredSession.Document.Areas[0].Color != "#22c55e" {
		t.Fatal("migration replaced custom area color", err)
	}
	// Migrate existing template and session documents without losing light settings.
	for _, table := range []string{"battle_map", "session_map"} {
		exec("UPDATE dndshare." + table + " SET document = (document - 'lightingEnabled') || jsonb_build_object('lights', (SELECT jsonb_agg(light - 'showMarker') FROM jsonb_array_elements(document->'lights') light))")
	}
	exec(schemaMapLightingModeSQL)
	migrated, err := s.GetBattleMap(ctx, 1, m.ID)
	if err != nil || migrated.Document.LightingEnabled || !migrated.Document.Lights[0].ShowMarker || migrated.Document.Lights[0].Color != "#ffc36a" || migrated.Document.Sun.Angle != 90 {
		t.Fatal("template lighting migration lost metadata", err)
	}
	migratedSession, err := s.GetSessionMap(ctx, 10, a.ID)
	if err != nil || migratedSession.Document.LightingEnabled || !migratedSession.Document.Lights[0].ShowMarker || migratedSession.Document.Lights[0].AreaID != "room" {
		t.Fatal("session lighting migration lost metadata", err)
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
