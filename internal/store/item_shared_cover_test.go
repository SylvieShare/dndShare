package store

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"os"
	"strings"
	"testing"
)

func TestSharedSystemCoverPostgres(t *testing.T) {
	dsn := os.Getenv("DNDSHARE_MEDIA_TEST_DSN")
	if dsn == "" {
		t.Skip("set DNDSHARE_MEDIA_TEST_DSN to an empty local dndshare_test_* database")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Host != "127.0.0.1" || !strings.HasPrefix(cfg.ConnConfig.Database, "dndshare_test_") {
		t.Fatal("requires disposable local database")
	}
	cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	cfg.ConnConfig.RuntimeParams["client_encoding"] = "UTF8"
	ctx := context.Background()
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	if _, err = pool.Exec(ctx, `CREATE SCHEMA dndshare; CREATE TABLE dndshare.item(id bigint PRIMARY KEY,user_id bigint,cover_image_id bigint,icon_image_id bigint,data jsonb);
 INSERT INTO dndshare.item VALUES (1,NULL,99,10,'{"rules":1}'),(2,NULL,88,20,'{"rules":2}'),(3,7,77,30,'{}'),(4,NULL,NULL,40,'{}');`); err != nil {
		t.Fatal(err)
	}
	defer pool.Exec(ctx, `DROP SCHEMA dndshare CASCADE`)
	s := &Store{pool: pool}
	if err = s.ReuseSystemItemCover(ctx, 2, 1); err != nil {
		t.Fatal(err)
	}
	var valid bool
	if err = pool.QueryRow(ctx, `SELECT cover_image_id=99 AND icon_image_id=20 AND data='{"rules":2}' FROM dndshare.item WHERE id=2`).Scan(&valid); err != nil || !valid {
		t.Fatalf("unrelated fields changed: %v", err)
	}
	for _, pair := range [][2]int64{{2, 3}, {3, 1}, {2, 4}, {2, 999}, {999, 1}} {
		if err = s.ReuseSystemItemCover(ctx, pair[0], pair[1]); !errors.Is(err, ErrNotFound) {
			t.Fatalf("invalid pair %v: %v", pair, err)
		}
	}
	if err = pool.QueryRow(ctx, `SELECT cover_image_id=99 FROM dndshare.item WHERE id=2`).Scan(&valid); err != nil || !valid {
		t.Fatal("rejected reuse changed cover")
	}
}
