package store

import (
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestInventoryIconPresetsPostgres(t *testing.T) {
	dsn := os.Getenv("DNDSHARE_ICON_PRESET_TEST_DSN")
	if dsn == "" {
		t.Skip("requires disposable local dndshare_test_* database")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Host != "127.0.0.1" || !strings.HasPrefix(cfg.ConnConfig.Database, "dndshare_test_") {
		t.Fatal("requires disposable local database")
	}
	pool, err := pgxpool.NewWithConfig(t.Context(), cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	exec := func(sql string) {
		t.Helper()
		if _, err := pool.Exec(t.Context(), sql); err != nil {
			t.Fatal(err)
		}
	}
	exec(`DROP SCHEMA IF EXISTS dndshare CASCADE; CREATE SCHEMA dndshare;
        CREATE TABLE dndshare.item_type(id bigint PRIMARY KEY); INSERT INTO dndshare.item_type VALUES(2);
        CREATE TABLE dndshare.storage_image(id bigserial PRIMARY KEY,user_id bigint,key text UNIQUE,url text,type text,deleted boolean DEFAULT false,file_name text,mime_type text,file_size bigint);
        CREATE UNIQUE INDEX idx_system_image ON dndshare.storage_image(key) WHERE user_id IS NULL AND key LIKE 'system-item-media/%';`)
	exec(schemaInventoryIconPresetsSQL)
	s := &Store{pool: pool}
	p := InventoryIconPreset{ItemTypeID: 2, Code: "key", Name: "Ключ", Purpose: "item"}
	p, old, err := s.SetInventoryIconPresetImage(t.Context(), p, "system-item-media/key.webp", "/key.webp", "key.webp", "image/webp", 100)
	if err != nil || old != nil || p.ID == 0 {
		t.Fatalf("first upload: %+v %v %v", p, old, err)
	}
	next, old, err := s.SetInventoryIconPresetImage(t.Context(), p, "system-item-media/key-v2.webp", "/key-v2.webp", "key-v2.webp", "image/webp", 120)
	if err != nil || next.ID != p.ID || old == nil || *old != p.ImageID {
		t.Fatalf("replacement: %+v %v %v", next, old, err)
	}
	again, _, err := s.SetInventoryIconPresetImage(t.Context(), p, "system-item-media/key-v2.webp", "/key-v2.webp", "key-v2.webp", "image/webp", 120)
	if err != nil || again.ImageID != next.ImageID {
		t.Fatalf("retry must reuse media: %+v %v", again, err)
	}
	presets, err := s.InventoryIconPresets(t.Context())
	if err != nil || len(presets) != 1 || presets[0].ImageURL != "/key-v2.webp" {
		t.Fatalf("projection: %+v %v", presets, err)
	}
	exec(`ALTER TABLE dndshare.item_type ADD COLUMN icon_image_id bigint, ADD COLUMN cover_image_id bigint;
		CREATE TABLE dndshare.suggest(icon_image_id bigint);
        CREATE TABLE dndshare.item(icon_image_id bigint,cover_image_id bigint);
        CREATE TABLE dndshare."char"(icon_image_id bigint);`)
	for _, table := range []string{"session_image_catalog", "session_chapter", "session_scene", "session_location", "session_npc"} {
		exec("CREATE TABLE dndshare." + table + "(image_id bigint)")
	}
	for _, table := range []string{"session_material", "battle_map", "session_map"} {
		exec("CREATE TABLE dndshare." + table + "(asset_id bigint)")
	}
	key, err := s.MarkStorageImageDeletedIfUnreferenced(t.Context(), next.ImageID)
	if err != nil || key != nil {
		t.Fatalf("preset image must remain active: %v %v", key, err)
	}
	key, err = s.MarkStorageImageDeletedIfUnreferenced(t.Context(), p.ImageID)
	if err != nil || key == nil || *key != "system-item-media/key.webp" {
		t.Fatalf("unreferenced replaced image can be cleaned: %v %v", key, err)
	}
	exec(`UPDATE dndshare.storage_image SET deleted=true`)
	presets, err = s.InventoryIconPresets(t.Context())
	if err != nil || len(presets) != 0 {
		t.Fatalf("deleted images: %+v %v", presets, err)
	}
}
