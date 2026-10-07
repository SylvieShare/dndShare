package store

import (
	"context"
	"errors"
	"os"
	"reflect"
	"strings"
	"sync"
	"testing"

	"dndshare/internal/battlemap"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestMapModelRevisionPersistence(t *testing.T) {
	dsn := os.Getenv("DNDSHARE_MAP_TEST_DSN")
	if dsn == "" {
		t.Skip("requires a disposable local dndshare_test_* database")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Host != "127.0.0.1" || !strings.HasPrefix(cfg.ConnConfig.Database, "dndshare_test_") {
		t.Fatal("requires an isolated local test database")
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
	exec(`CREATE SCHEMA dndshare; CREATE TABLE dndshare.users(id bigint PRIMARY KEY); CREATE TABLE dndshare.session(id bigint PRIMARY KEY); CREATE TABLE dndshare.storage_image(id bigint PRIMARY KEY);`)
	defer exec(`DROP SCHEMA dndshare CASCADE`)
	exec(schemaBattleMapsSQL)
	exec(schema3DMapsSQL)
	exec(schemaModelSupportSlotsSQL)
	exec(schemaModelMountDepthSQL)
	exec(schemaModelBaseFootprintsSQL)
	exec(schemaModelTextureDetailSQL)
	exec(`INSERT INTO dndshare.map_model(id,collection,source_code,source_name,name,version,tile_type,terrain_type,wall_layout,geometry,assets)
SELECT '00000000-0000-4000-8000-000000000099','migration-test','CUSTOM','Custom wall','Custom wall',1,'wall','cave','arched-door',geometry,assets
FROM dndshare.map_model LIMIT 1`)
	exec(`INSERT INTO dndshare.map_model(id,collection,source_code,source_name,name,version,tile_type,terrain_type,wall_layout,geometry,assets)
SELECT item.id::uuid,'shape-reference',item.code,item.name,item.name,1,'wall','dungeon','custom',model.geometry,model.assets
FROM (VALUES
 ('00000000-0000-4000-8000-000000000096','UD-096','Wall Corner'),
 ('00000000-0000-4000-8000-000000000097','UD-097','Wall Diagonal'),
 ('00000000-0000-4000-8000-000000000014','UD-014','Angle')
) AS item(id,code,name) CROSS JOIN LATERAL (SELECT geometry,assets FROM dndshare.map_model LIMIT 1) model`)
	exec(schemaModelTileCategoriesSQL)
	exec(schemaModelWallShapesSQL)
	exec(schemaModelSurfacesObjectsSQL)
	exec(schemaMeasuredPlacementPointsSQL)
	exec(schemaModelShadowAssetsSQL)
	exec(schemaModelBehaviourSQL)
	s := &Store{pool: pool}
	exec(`INSERT INTO dndshare.map_model(id,collection,source_code,source_name,name,version,tile_type,geometry,assets)
SELECT item.id::uuid,item.collection,item.code,item.name,item.name,1,'floor',
 model.geometry || '{"hasDecor":false,"canStand":true,"placementPoints":[{"x":0.5,"y":0.5,"elevation":0.4}]}'::jsonb,model.assets
FROM (VALUES
 ('00000000-0000-4000-8000-000000000131','ultimate-dungeon','UD-031','Ground Table Full'),
 ('00000000-0000-4000-8000-000000000168','lost-cave','LC-068','Well Ground Empty'),
 ('00000000-0000-4000-8000-000000000149','ultimate-dungeon','UD-049','Ground Symbol Pentacle')
) AS item(id,collection,code,name) CROSS JOIN LATERAL (SELECT geometry,assets FROM dndshare.map_model LIMIT 1) model`)
	beforeContent := map[string]battlemap.Model{}
	for _, id := range []string{"00000000-0000-4000-8000-000000000131", "00000000-0000-4000-8000-000000000168", "00000000-0000-4000-8000-000000000149"} {
		beforeContent[id], err = s.GetMapModel(ctx, id)
		if err != nil {
			t.Fatal(err)
		}
	}
	exec(schemaModelFurnishingsSQL)
	for id, expected := range beforeContent {
		expected.HasDecor = expected.SourceCode != "UD-049"
		after, err := s.GetMapModel(ctx, id)
		if err != nil || !reflect.DeepEqual(after, expected) {
			t.Fatalf("furnishings correction changed placement or assets: %+v %v", after, err)
		}
	}
	for _, expected := range battlemap.InitialCatalogue() {
		migrated, err := s.GetMapModel(ctx, expected.ID)
		if err != nil || migrated.TileType != expected.TileType || !reflect.DeepEqual(migrated.Assets, expected.Assets) {
			t.Fatalf("migration changed identity/assets or lost category for %s: %+v %v", expected.SourceCode, migrated, err)
		}
	}
	custom, err := s.GetMapModel(ctx, "00000000-0000-4000-8000-000000000099")
	if err != nil || custom.TileType != "wall-straight" {
		t.Fatalf("unknown wall shape lost during migration: %+v %v", custom, err)
	}
	for id, category := range map[string]string{
		"00000000-0000-4000-8000-000000000096": "wall-corner",
		"00000000-0000-4000-8000-000000000097": "wall-diagonal",
		"00000000-0000-4000-8000-000000000014": "wall-angle",
	} {
		model, err := s.GetMapModel(ctx, id)
		if err != nil || model.TileType != category {
			t.Fatalf("wall shape reference classified incorrectly: %+v %v", model, err)
		}
	}
	testMapModelBehaviours(t, ctx, s)
	testMapModelPreviewRevision(t, ctx, s)
	var oldColumns int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM information_schema.columns WHERE table_schema='dndshare' AND table_name='map_model' AND column_name IN ('wall_layout','terrain_type')`).Scan(&oldColumns); err != nil || oldColumns != 0 {
		t.Fatalf("redundant fields survived migration: %d %v", oldColumns, err)
	}
	base := battlemap.InitialCatalogue()[0]
	base.Collection = "test"
	base.ID = "00000000-0000-4000-8000-000000000001"
	if base, err = s.RegisterMapModel(ctx, base); err != nil {
		t.Fatal(err)
	}
	edit := base
	edit.ID = "00000000-0000-4000-8000-000000000002"
	edit.Name = "Updated"
	edit.Width = 2
	edit.TileType = "wall-angle"
	saved, err := s.ReviseMapModel(ctx, base.ID, edit)
	if err != nil {
		t.Fatal(err)
	}
	if saved.Version != 2 || saved.Width != 2 || saved.TileType != "wall-angle" || !reflect.DeepEqual(saved.Assets, base.Assets) {
		t.Fatalf("unexpected revision: %+v", saved)
	}
	old, err := s.GetMapModel(ctx, base.ID)
	if err != nil || !reflect.DeepEqual(old, base) {
		t.Fatalf("original changed: %+v %v", old, err)
	}
	loaded, err := s.GetMapModel(ctx, saved.ID)
	if err != nil || !reflect.DeepEqual(loaded, saved) {
		t.Fatalf("revision readback: %+v %v", loaded, err)
	}
	if _, err = s.ReviseMapModel(ctx, base.ID, edit); !errors.Is(err, ErrMapModelConflict) {
		t.Fatalf("stale edit accepted: %v", err)
	}
	var wg sync.WaitGroup
	results := make(chan error, 2)
	for _, id := range []string{"00000000-0000-4000-8000-000000000003", "00000000-0000-4000-8000-000000000004"} {
		wg.Add(1)
		go func(id string) {
			defer wg.Done()
			m := saved
			m.ID = id
			m.Name = "Concurrent"
			_, err := s.ReviseMapModel(ctx, saved.ID, m)
			results <- err
		}(id)
	}
	wg.Wait()
	close(results)
	successes, conflicts := 0, 0
	for err := range results {
		if err == nil {
			successes++
		} else if errors.Is(err, ErrMapModelConflict) {
			conflicts++
		} else {
			t.Fatal(err)
		}
	}
	if successes != 1 || conflicts != 1 {
		t.Fatalf("concurrent edits: success=%d conflict=%d", successes, conflicts)
	}
	shadowBase := battlemap.InitialCatalogue()[0]
	shadowBase.Collection = "shadow-test"
	shadowBase.ID = "00000000-0000-4000-8000-000000000010"
	if shadowBase, err = s.RegisterMapModel(ctx, shadowBase); err != nil {
		t.Fatal(err)
	}
	asset := shadowBase.Assets["shadow"]
	asset.SHA256 = strings.Repeat("f", 64)
	asset.Key = "map-models/" + asset.SHA256 + ".glb"
	asset.FileName = "shadow.glb"
	shadow, err := s.ReviseMapModelShadow(ctx, shadowBase.ID, shadowBase.Assets["lod"].SHA256, "00000000-0000-4000-8000-000000000011", asset)
	if err != nil || shadow.Version != 2 || !battlemap.VisualRevision(shadowBase, shadow) {
		t.Fatalf("shadow broke immutable presentation: %+v %v", shadow, err)
	}
	for _, kind := range []string{"render", "lod", "preview", "source"} {
		if shadow.Assets[kind] != shadowBase.Assets[kind] {
			t.Fatal("shadow changed existing asset", kind)
		}
	}
	unchanged, err := s.GetMapModel(ctx, shadowBase.ID)
	if err != nil || !reflect.DeepEqual(unchanged, shadowBase) {
		t.Fatal("shadow publication mutated original model", err)
	}
	repeated, err := s.ReviseMapModelShadow(ctx, shadowBase.ID, shadowBase.Assets["lod"].SHA256, "00000000-0000-4000-8000-000000000012", asset)
	if err != nil || repeated.ID != shadow.ID {
		t.Fatal("shadow registration is not idempotent", err)
	}
	if _, err = s.ReviseMapModelShadow(ctx, shadow.ID, strings.Repeat("a", 64), "00000000-0000-4000-8000-000000000013", asset); !errors.Is(err, ErrMapModelConflict) {
		t.Fatal("stale shadow geometry accepted", err)
	}
}
