package store

import (
	"context"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
)

func TestCatalogueEditingMigration(t *testing.T) {
	dsn := os.Getenv("DNDSHARE_CATALOGUE_TEST_DSN")
	if dsn == "" {
		t.Skip("set DNDSHARE_CATALOGUE_TEST_DSN to an empty local disposable database")
	}
	cfg, err := pgx.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(cfg.Database, "dndshare_test_") || (cfg.Host != "127.0.0.1" && cfg.Host != "localhost") {
		t.Fatal("requires a local dndshare_test_* database")
	}
	cfg.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	ctx := context.Background()
	conn, err := pgx.ConnectConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close(ctx)
	tx, err := conn.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	exec := func(sql string) {
		t.Helper()
		if _, err := tx.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	exec(`CREATE SCHEMA dndshare; CREATE TABLE dndshare.item_type (id int PRIMARY KEY, fields jsonb);
INSERT INTO dndshare.item_type SELECT id, '[{"key":"untouched","name":"Keep me","type":"text","readonly":true},{"key":"weight","name":"Weight","type":"int","filter":true}]'::jsonb FROM generate_series(1,18) id;`)
	exec(schemaCatalogueEditingSQL)
	check := func(sql string) {
		t.Helper()
		var ok bool
		if err := tx.QueryRow(ctx, sql).Scan(&ok); err != nil || !ok {
			t.Fatalf("migration invariant failed: %s: %v", sql, err)
		}
	}
	check(`SELECT bool_and(fields->0 = '{"key":"untouched","name":"Keep me","type":"text","readonly":true}'::jsonb) FROM dndshare.item_type`)
	check(`SELECT field->>'type'='float' AND field->>'filter'='true' FROM dndshare.item_type, jsonb_array_elements(fields) field WHERE id=2 AND field->>'key'='weight'`)
	check(`SELECT count(*)=3 FROM dndshare.item_type, jsonb_array_elements(fields) field, jsonb_array_elements(field->'fields') child WHERE id=5 AND field->>'key'='damage' AND child->>'key' IN ('save_ability','scaling','addon')`)
	check(`SELECT child->>'type'='item_array' AND child->>'item_type'='2' FROM dndshare.item_type, jsonb_array_elements(fields) field, jsonb_array_elements(field->'fields') child WHERE id=11 AND field->>'key'='item_choices' AND child->>'key'='option_item_ids'`)
	check(`SELECT child->>'type'='item' FROM dndshare.item_type, jsonb_array_elements(fields) field, jsonb_array_elements(field->'fields') child WHERE id=11 AND field->>'key'='equipment_items' AND child->>'key'='item_id'`)
	check(`SELECT count(*)=2 FROM dndshare.item_type, jsonb_array_elements(fields) field WHERE id IN (9,17) AND field->>'key'='caster_progression'`)
	check(`SELECT count(*)=1 FROM dndshare.item_type, jsonb_array_elements(fields) field WHERE id=8 AND field->>'key'='variants'`)
	check(`SELECT bool_and(jsonb_array_length(fields)=2) FROM dndshare.item_type WHERE id IN (3,4,7,18)`)
	exec(schemaCatalogueEditingSQL)
	check(`SELECT NOT EXISTS (SELECT id, field->>'key' FROM dndshare.item_type, jsonb_array_elements(fields) field GROUP BY id, field->>'key' HAVING count(*) > 1)`)
}
