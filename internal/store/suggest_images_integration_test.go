package store

import (
	"errors"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestSuggestImagesPostgres(t *testing.T) {
	dsn := os.Getenv("DNDSHARE_SUGGEST_IMAGE_TEST_DSN")
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
        CREATE TABLE dndshare.storage_image(id bigserial PRIMARY KEY,user_id bigint,key text,url text,type text,deleted boolean DEFAULT false,file_name text,mime_type text,file_size bigint);
        CREATE UNIQUE INDEX idx_system_image ON dndshare.storage_image(key) WHERE user_id IS NULL AND key LIKE 'system-item-media/%';
        CREATE TABLE dndshare.svg_storage(id bigint PRIMARY KEY,data text);
        CREATE TABLE dndshare.suggest(type_id bigint,id bigint,user_id bigint,value text,code text,color text,"desc" text,svg_id bigint,PRIMARY KEY(type_id,id));
        INSERT INTO dndshare.suggest(type_id,id,value,user_id) VALUES(17,1,'мм',NULL),(18,1,'other',NULL),(17,2,'custom',10);`)
	exec(schemaSuggestImagesSQL)
	s := &Store{pool: pool}
	install := func(typeID, id int64, suffix string) (int64, *int64, error) {
		return s.SetSystemSuggestImage(t.Context(), typeID, id, "system-item-media/"+suffix+".webp", "/"+suffix+".webp", suffix+".webp", "image/webp", 100)
	}
	first, old, err := install(17, 1, "copper")
	if err != nil || old != nil || first == 0 {
		t.Fatalf("first upload: %d %v %v", first, old, err)
	}
	again, _, err := install(17, 1, "copper")
	if err != nil || again != first {
		t.Fatalf("retry must reuse shared image ID: %d %v", again, err)
	}
	items, err := s.GetSuggestsByType(t.Context(), 17, nil)
	if err != nil || len(items) != 1 || items[0].IconImageID == nil || *items[0].IconImageID != first || items[0].IconImageURL == nil || *items[0].IconImageURL != "/copper.webp" {
		t.Fatalf("projection: %+v %v", items, err)
	}
	other, err := s.GetSuggestsByType(t.Context(), 18, nil)
	if err != nil || len(other) != 1 || other[0].IconImageID != nil {
		t.Fatalf("same id in another type must stay untouched: %+v %v", other, err)
	}
	for _, pair := range [][2]int64{{17, 2}, {17, 999}} {
		if _, _, err := install(pair[0], pair[1], "rejected"); !errors.Is(err, ErrNotFound) {
			t.Fatalf("user-owned/missing target must be rejected: %v", err)
		}
	}
	var rejectedCount int
	if err := pool.QueryRow(t.Context(), `SELECT count(*) FROM dndshare.storage_image WHERE key='system-item-media/rejected.webp'`).Scan(&rejectedCount); err != nil || rejectedCount != 0 {
		t.Fatalf("rejected upload must not create storage rows: %d %v", rejectedCount, err)
	}
	exec(`UPDATE dndshare.storage_image SET deleted=true`)
	items, err = s.GetSuggestsByType(t.Context(), 17, nil)
	if err != nil || len(items) != 1 || items[0].IconImageURL != nil {
		t.Fatalf("deleted image URL must not be projected: %+v %v", items, err)
	}
	second, old, err := install(17, 1, "copper-v2")
	if err != nil || second == first || old == nil || *old != first {
		t.Fatalf("replacement: %d %v %v", second, old, err)
	}
	// The shared cleanup guard must see a suggest reference, including a
	// reference shared by two dictionary entries.
	exec(`UPDATE dndshare.suggest SET icon_image_id=(SELECT icon_image_id FROM dndshare.suggest WHERE type_id=17 AND id=1) WHERE type_id=18;
        CREATE TABLE dndshare.item_type(icon_image_id bigint,cover_image_id bigint);
        CREATE TABLE dndshare.item_icon_preset(image_id bigint);
        CREATE TABLE dndshare.item(icon_image_id bigint,cover_image_id bigint);
        CREATE TABLE dndshare."char"(icon_image_id bigint);`)
	for _, table := range []string{"session_image_catalog", "session_chapter", "session_scene", "session_location", "session_npc"} {
		exec("CREATE TABLE dndshare." + table + "(image_id bigint)")
	}
	for _, table := range []string{"session_material", "battle_map", "session_map"} {
		exec("CREATE TABLE dndshare." + table + "(asset_id bigint)")
	}
	if key, err := s.MarkStorageImageDeletedIfUnreferenced(t.Context(), second); err != nil || key != nil {
		t.Fatalf("referenced image must remain active: %v %v", key, err)
	}
	exec(`UPDATE dndshare.suggest SET icon_image_id=NULL WHERE type_id=17`)
	if key, err := s.MarkStorageImageDeletedIfUnreferenced(t.Context(), second); err != nil || key != nil {
		t.Fatalf("shared suggest reference must protect image: %v %v", key, err)
	}
	exec(`UPDATE dndshare.suggest SET icon_image_id=NULL`)
	if key, err := s.MarkStorageImageDeletedIfUnreferenced(t.Context(), second); err != nil || key == nil {
		t.Fatalf("unreferenced image can be cleaned: %v %v", key, err)
	}
}
