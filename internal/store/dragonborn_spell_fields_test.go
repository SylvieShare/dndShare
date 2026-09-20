package store

import (
	"context"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestDragonbornSpellFieldsMigration(t *testing.T) {
	dsn := os.Getenv("DNDSHARE_DRAGON_TEST_DSN")
	if dsn == "" {
		t.Skip("set DNDSHARE_DRAGON_TEST_DSN to an empty local test database")
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
	exec := func(sql string) {
		t.Helper()
		if _, err := pool.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	exec(`CREATE SCHEMA dndshare; CREATE TABLE dndshare.item_type(id bigint, fields jsonb);
 INSERT INTO dndshare.item_type VALUES
 (5,'[{"key":"rolls","fields":[{"key":"label","type":"text"},{"key":"kind","type":"text","default":"effect","filter_values":["damage","heal","effect"]}]}]'),
 (8,'[{"key":"variants","fields":[{"key":"value","type":"text"}]}]');`)
	defer pool.Exec(ctx, `DROP SCHEMA dndshare CASCADE`)
	exec(schemaSpellFixedSaveDCSQL)
	var valid bool
	if err := pool.QueryRow(ctx, `SELECT fields->0->'fields'->1='null'::jsonb FROM dndshare.item_type WHERE id=5`).Scan(&valid); err != nil || !valid {
		t.Fatal("did not reproduce legacy null kind", err)
	}
	exec(schemaDragonbornDefensesSQL)
	err = pool.QueryRow(ctx, `SELECT
 (SELECT fields->0->'fields'->0->>'key'='label' AND fields->0->'fields'->1->>'key'='kind' AND fields->0->'fields'->1->>'type'='select'
 AND jsonb_array_length(fields->0->'fields'->1->'options')=4 AND fields->0->'fields'->2->>'key'='save_dc' FROM dndshare.item_type WHERE id=5)
 AND (SELECT fields->0->'fields'->0->>'key'='value' AND fields->0->'fields'->1->>'key'='damage_type'
 AND fields->0->'fields'->2->>'key'='defenses' FROM dndshare.item_type WHERE id=8)`).Scan(&valid)
	if err != nil || !valid {
		t.Fatalf("field repair failed: %v", err)
	}
}
