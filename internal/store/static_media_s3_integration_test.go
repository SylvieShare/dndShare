package store

import (
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestStaticMediaS3MigrationPostgres(t *testing.T) {
	dsn := os.Getenv("DNDSHARE_STATIC_MEDIA_TEST_DSN")
	if dsn == "" {
		t.Skip("requires disposable local dndshare_test_* database")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Host != "127.0.0.1" || !strings.HasPrefix(cfg.ConnConfig.Database, "dndshare_test_") {
		t.Fatal("requires isolated local database")
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
	exec(`CREATE SCHEMA dndshare;
 CREATE TABLE dndshare.storage_image(id bigint PRIMARY KEY,user_id bigint,"key" text UNIQUE,
 url text,"type" text,deleted boolean DEFAULT false,file_name text,mime_type text,file_size bigint);
 CREATE TABLE dndshare.item_type(id bigint PRIMARY KEY,icon_image_id bigint REFERENCES dndshare.storage_image(id));
 INSERT INTO dndshare.storage_image(id,"key",url,"type",deleted) VALUES
 (1,'static-handbook-type-icons/v1/1-weapons.png','/static/handbook-types/1-weapons.png','item_type_icon',false),
 (2,'static-status-effect-media/v1/inspiration/icon.png','/static/status-effects/inspiration-icon.png','item_icon',false),
 (3,'static-status-effect-media/v1/exhaustion/icon.png','/static/status-effects/exhaustion-icon.png','item_icon',true),
 (4,'static-handbook-type-icons/v1/2-items.png','https://example.test/replaced.webp','item_type_icon',false);
 INSERT INTO dndshare.storage_image(id,user_id,"key",url,"type") VALUES
 (5,42,'static-handbook-type-icons/v1/3-racial-abilities.png','/static/handbook-types/3-racial-abilities.png','image');
 INSERT INTO dndshare.item_type VALUES(1,1),(17,1);`)
	defer exec(`DROP SCHEMA dndshare CASCADE`)
	for range 2 {
		exec(schemaStaticMediaS3SQL)
		var migrated, shared, preserved int
		if err := pool.QueryRow(t.Context(), `SELECT count(*) FROM dndshare.storage_image
 WHERE id IN (1,2,3) AND "key" LIKE 'system-item-media/v1/static/%'
 AND url='https://storage.yandexcloud.net/dndshare/' || "key"
 AND mime_type='image/webp' AND file_size>0`).Scan(&migrated); err != nil || migrated != 3 {
			t.Fatalf("seeded media did not migrate: count=%d err=%v", migrated, err)
		}
		if err := pool.QueryRow(t.Context(), `SELECT count(*) FROM dndshare.item_type
 WHERE icon_image_id=1`).Scan(&shared); err != nil || shared != 2 {
			t.Fatalf("shared image IDs changed: count=%d err=%v", shared, err)
		}
		if err := pool.QueryRow(t.Context(), `SELECT count(*) FROM dndshare.storage_image WHERE
 (id=3 AND deleted=true AND "type"='item_icon') OR
 (id=4 AND url='https://example.test/replaced.webp' AND mime_type IS NULL) OR
 (id=5 AND user_id=42 AND url='/static/handbook-types/3-racial-abilities.png' AND mime_type IS NULL)`).Scan(&preserved); err != nil || preserved != 3 {
			t.Fatalf("deleted state, replacement or ownership changed: count=%d err=%v", preserved, err)
		}
	}
}
