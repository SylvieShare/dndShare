package store

import (
	"context"
	"errors"
	"os"
	"reflect"
	"strings"
	"testing"

	"dndshare/internal/battlemap"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestCurrentMapModelPersistence(t *testing.T) {
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
	exec(schemaModelGroupCodesSQL)
	testCurrentModelMigration(t, ctx, pool)
	exec(schemaMapPreviewsSQL)
	s := &Store{pool: pool}
	exec(`INSERT INTO dndshare.map_model(id,collection,source_code,source_name,name,tile_type,geometry,assets)
SELECT item.id::uuid,item.collection,item.code,item.name,item.name,'floor',
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
	testModelGroupCodeRules(t, ctx, s)
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
	saved, err := s.UpdateMapModel(ctx, base.ID, edit)
	if err != nil || saved.ID != base.ID || saved.Width != 2 || saved.Name != "Updated" || !reflect.DeepEqual(saved.Assets, base.Assets) {
		t.Fatal("current metadata update", saved, err)
	}
	loaded, err := s.GetMapModel(ctx, base.ID)
	if err != nil || !reflect.DeepEqual(loaded, saved) {
		t.Fatal("current readback", err)
	}
	saved.Assets["render"] = battlemap.ModelAsset{SHA256: strings.Repeat("e", 64), Key: "new-render.glb"}
	published, err := s.RegisterMapModel(ctx, saved)
	if err != nil || published.ID != base.ID || published.Assets["render"] != saved.Assets["render"] {
		t.Fatal("current publication", err)
	}
	invalid := published
	invalid.ID = "00000000-0000-4000-8000-000000000002"
	if _, err = s.RegisterMapModel(ctx, invalid); err == nil {
		t.Fatal("new UUID accepted for existing model")
	}
	var count int
	if err = pool.QueryRow(ctx, `SELECT count(*) FROM dndshare.map_model WHERE definition_id=$1`, published.DefinitionID).Scan(&count); err != nil || count != 1 {
		t.Fatal("historical rows survived", count, err)
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
	shadow, err := s.UpdateMapModelShadow(ctx, shadowBase.ID, shadowBase.Assets["lod"].SHA256, asset)
	if err != nil || shadow.ID != shadowBase.ID || shadow.Assets["shadow"] != asset {
		t.Fatalf("shadow broke immutable presentation: %+v %v", shadow, err)
	}
	for _, kind := range []string{"render", "lod", "preview", "source"} {
		if shadow.Assets[kind] != shadowBase.Assets[kind] {
			t.Fatal("shadow changed existing asset", kind)
		}
	}
	unchanged, err := s.GetMapModel(ctx, shadowBase.ID)
	if err != nil || !reflect.DeepEqual(unchanged, shadow) {
		t.Fatal("shadow publication was not visible through the stable UUID", err)
	}
	repeated, err := s.UpdateMapModelShadow(ctx, shadowBase.ID, shadowBase.Assets["lod"].SHA256, asset)
	if err != nil || repeated.ID != shadow.ID {
		t.Fatal("shadow registration is not idempotent", err)
	}
	if _, err = s.UpdateMapModelShadow(ctx, shadow.ID, strings.Repeat("a", 64), asset); !errors.Is(err, ErrMapModelConflict) {
		t.Fatal("stale shadow geometry accepted", err)
	}
}
