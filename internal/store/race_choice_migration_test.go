package store

import (
	"context"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestRaceChoicePresentationMigration(t *testing.T) {
	dsn := os.Getenv("DNDSHARE_RACE_CHOICE_TEST_DSN")
	if dsn == "" {
		t.Skip("set DNDSHARE_RACE_CHOICE_TEST_DSN to an empty local test database")
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
	if _, err = pool.Exec(ctx, `CREATE SCHEMA dndshare; CREATE TABLE dndshare.item_type(id bigint,fields jsonb);
 INSERT INTO dndshare.item_type SELECT id,'[{"key":"desc","type":"description"},{"key":"granted_spells","type":"object_array","fields":[{"key":"spell","type":"item","item_type":5}]}]'::jsonb FROM unnest(ARRAY[3,4,7,18]) id;`); err != nil {
		t.Fatal(err)
	}
	defer pool.Exec(ctx, `DROP SCHEMA dndshare CASCADE`)
	if _, err = pool.Exec(ctx, schemaRaceChoicePresentationSQL); err != nil {
		t.Fatal(err)
	}
	var valid bool
	err = pool.QueryRow(ctx, `SELECT
 (SELECT count(*)=2 FROM dndshare.item_type t, jsonb_array_elements(t.fields) f WHERE f->>'key'='choice_only' AND t.id IN (3,4))
 AND (SELECT count(*)=4 FROM dndshare.item_type t,jsonb_array_elements(t.fields) f,jsonb_array_elements(f->'fields') g WHERE f->>'key'='granted_spells' AND g->>'key'='ability_choice_source' AND g->>'item_type'='3')
 AND (SELECT bool_and(fields->0->>'key'='desc' AND fields->1->'fields'->0->>'key'='spell') FROM dndshare.item_type)`).Scan(&valid)
	if err != nil || !valid {
		t.Fatalf("migration did not preserve fields/add casting links: %v", err)
	}
}
