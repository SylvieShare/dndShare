package store

import (
	"context"
	"dndshare/internal/testdb"
	"errors"
	"reflect"
	"strings"
	"testing"

	"dndshare/internal/battlemap"
)

func TestCurrentMapModelPersistence(t *testing.T) {
	pool := testdb.Pool(t)
	ctx := context.Background()
	var err error
	exec := func(sql string) {
		t.Helper()
		if _, err := pool.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	exec(`CREATE SCHEMA dndshare; CREATE TABLE dndshare.users(id bigint PRIMARY KEY); CREATE TABLE dndshare.session(id bigint PRIMARY KEY); CREATE TABLE dndshare.storage_image(id bigint PRIMARY KEY); INSERT INTO dndshare.users VALUES(1);`)
	defer exec(`DROP SCHEMA dndshare CASCADE`)
	exec(testSchemaTables(t, "battle_map", "battle_map_model", "battle_map_preview", "map_model", "map_model_definition", "map_model_group", "map_model_transition", "session_map", "session_map_model", "session_map_display"))
	s := &Store{pool: pool}
	seedMapModelsForTest(t, s)
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
	testTileTransitionPersistence(t, ctx, s)
	testMapModelGrouping(t, ctx, s)
	testMapModelCatalogue(t, ctx, s)
	testModelPlacementCells(t, ctx, s)
}
