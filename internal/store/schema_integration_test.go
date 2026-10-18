package store

import (
	"context"
	"fmt"
	"os"
	"reflect"
	"strings"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func schemaTestPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dsn := os.Getenv("DNDSHARE_SCHEMA_TEST_DSN")
	if dsn == "" {
		t.Skip("requires an isolated local dndshare_test_* database")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Host != "127.0.0.1" || !strings.HasPrefix(cfg.ConnConfig.Database, "dndshare_test_") {
		t.Fatal("requires an isolated local dndshare_test_* database")
	}
	cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	pool, err := pgxpool.NewWithConfig(t.Context(), cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	schemaTestExec(t, pool, `DROP SCHEMA IF EXISTS dndshare CASCADE`)
	t.Cleanup(func() { schemaTestExec(t, pool, `DROP SCHEMA IF EXISTS dndshare CASCADE`) })
	return pool
}

func schemaTestExec(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) {
	t.Helper()
	if _, err := pool.Exec(context.Background(), sql, args...); err != nil {
		t.Fatal(err)
	}
}

func businessTableDigests(t *testing.T, pool *pgxpool.Pool) map[string]string {
	t.Helper()
	rows, err := pool.Query(t.Context(), `SELECT tablename FROM pg_tables WHERE schemaname='dndshare' AND tablename<>'schema_migration' ORDER BY tablename`)
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			t.Fatal(err)
		}
		names = append(names, name)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		t.Fatal(err)
	}
	result := make(map[string]string, len(names))
	for _, name := range names {
		query := `SELECT md5(COALESCE(string_agg(md5(row_to_json(r)::text),',' ORDER BY md5(row_to_json(r)::text)),'')) FROM ` + pgx.Identifier{"dndshare", name}.Sanitize() + ` r`
		var digest string
		if err := pool.QueryRow(t.Context(), query).Scan(&digest); err != nil {
			t.Fatal(err)
		}
		result[name] = digest
	}
	return result
}

func TestSchemaCreatesOnlyEmptyStructurePostgres(t *testing.T) {
	pool := schemaTestPool(t)
	s, err := Open(t.Context(), os.Getenv("DNDSHARE_SCHEMA_TEST_DSN"))
	if err != nil {
		t.Fatal(err)
	}
	s.Close()
	for pass := 0; pass < 2; pass++ {
		if err := applySchema(t.Context(), pool); err != nil {
			t.Fatal(err)
		}
		digests := businessTableDigests(t, pool)
		if len(digests) < 60 {
			t.Fatalf("incomplete current structure: %d business tables", len(digests))
		}
		for name, digest := range digests {
			if digest != "d41d8cd98f00b204e9800998ecf8427e" {
				t.Fatalf("startup populated business table %s", name)
			}
		}
		var count int
		if err := pool.QueryRow(t.Context(), `SELECT count(*) FROM dndshare.schema_migration`).Scan(&count); err != nil || count != len(schemaParts) {
			t.Fatalf("migration ledger: count=%d err=%v", count, err)
		}
	}
}

func TestSchemaAdoptsExistingStructureWithoutDataChangesPostgres(t *testing.T) {
	pool := schemaTestPool(t)
	original := schemaParts
	t.Cleanup(func() { schemaParts = original })
	// Reproduce the pre-baseline structure, without applying later migrations.
	schemaParts = original[:structuralBaselineCount]
	if err := applySchema(t.Context(), pool); err != nil {
		t.Fatal(err)
	}
	schemaParts = original
	schemaTestExec(t, pool, `INSERT INTO dndshare.source(id,name) VALUES(1,'DND5e');
 INSERT INTO dndshare.source_version(id,source_id,version) VALUES(1,1,'2014');
 INSERT INTO dndshare.users(id,login,password) VALUES(1,'canary','test');
 INSERT INTO dndshare.item_type(id,name,source_id,fields) VALUES(1,'Canary',1,'[]');
 INSERT INTO dndshare.item(id,type_id,name,data) VALUES(1,1,'Keep me','{"custom":"unchanged"}');
 CREATE TABLE dndshare.schema_data_migration(code text PRIMARY KEY);
 INSERT INTO dndshare.schema_data_migration VALUES('historical-data-operation');
 DELETE FROM dndshare.schema_migration;
 INSERT INTO dndshare.schema_migration(code,checksum) VALUES('foundation','historical-checksum');`)
	schemaTestExec(t, pool, `INSERT INTO dndshare.schema_migration(code,checksum) VALUES($1,$2)`, previousSchemaBoundary, previousSchemaBoundaryHash)
	before := businessTableDigests(t, pool)
	for pass := 0; pass < 2; pass++ {
		if err := applySchema(t.Context(), pool); err != nil {
			t.Fatal(err)
		}
		if after := businessTableDigests(t, pool); !reflect.DeepEqual(after, before) {
			t.Fatal("adopting or reopening the baseline changed business data")
		}
		var count int
		if err := pool.QueryRow(t.Context(), `SELECT count(*) FROM dndshare.schema_migration`).Scan(&count); err != nil || count != len(schemaParts)+2 {
			t.Fatalf("history must be preserved: count=%d err=%v", count, err)
		}
	}
	var historical string
	if err := pool.QueryRow(t.Context(), `SELECT checksum FROM dndshare.schema_migration WHERE code='foundation'`).Scan(&historical); err != nil || historical != "historical-checksum" {
		t.Fatal("historical ledger entry changed", err)
	}
	schemaTestExec(t, pool, `UPDATE dndshare.schema_migration SET checksum='changed' WHERE code=$1`, schemaParts[0].name)
	if err := applySchema(t.Context(), pool); err == nil || !strings.Contains(err.Error(), "changed after") {
		t.Fatal("changed applied migration accepted", err)
	}
	if after := businessTableDigests(t, pool); !reflect.DeepEqual(after, before) {
		t.Fatal("checksum rejection changed business data")
	}
}

func TestSchemaAppendsStructuralChangePostgres(t *testing.T) {
	pool := schemaTestPool(t)
	if err := applySchema(t.Context(), pool); err != nil {
		t.Fatal(err)
	}
	schemaTestExec(t, pool, `INSERT INTO dndshare.source(id,name) VALUES(1,'Keep source')`)
	original := schemaParts
	t.Cleanup(func() { schemaParts = original })
	schemaParts = append(append([]schemaPart{}, original...), schemaPart{"999_feature", `CREATE TABLE dndshare.feature_fixture(id bigint PRIMARY KEY)`})
	for range 2 {
		if err := applySchema(t.Context(), pool); err != nil {
			t.Fatal(err)
		}
		var name string
		if err := pool.QueryRow(t.Context(), `SELECT name FROM dndshare.source WHERE id=1`).Scan(&name); err != nil || name != "Keep source" {
			t.Fatal("structural change modified existing content", name, err)
		}
		var rows int
		if err := pool.QueryRow(t.Context(), `SELECT count(*) FROM dndshare.feature_fixture`).Scan(&rows); err != nil || rows != 0 {
			t.Fatal("new structural table was populated", rows, err)
		}
	}
}

func TestSchemaRefusesUnverifiedExistingDatabasePostgres(t *testing.T) {
	pool := schemaTestPool(t)
	if err := applySchema(t.Context(), pool); err != nil {
		t.Fatal(err)
	}
	schemaTestExec(t, pool, `DELETE FROM dndshare.schema_migration`)
	before := businessTableDigests(t, pool)
	if err := applySchema(t.Context(), pool); err == nil || !strings.Contains(err.Error(), "verified pre-baseline") {
		t.Fatal("unverified database adopted", err)
	}
	if after := businessTableDigests(t, pool); !reflect.DeepEqual(after, before) {
		t.Fatal("failed adoption changed data")
	}
}

func TestSchemaConcurrentStartsPostgres(t *testing.T) {
	pool := schemaTestPool(t)
	var wg sync.WaitGroup
	for range 4 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := applySchema(t.Context(), pool); err != nil {
				t.Error(err)
			}
		}()
	}
	wg.Wait()
	var count int
	if err := pool.QueryRow(t.Context(), `SELECT count(*) FROM dndshare.schema_migration`).Scan(&count); err != nil || count != len(schemaParts) {
		t.Fatalf("concurrent migration registry: %d %v", count, err)
	}
}

func TestSchemaRejectsDataMigrationBeforeExecutionPostgres(t *testing.T) {
	pool := schemaTestPool(t)
	if err := applySchema(t.Context(), pool); err != nil {
		t.Fatal(err)
	}
	original := schemaParts
	t.Cleanup(func() { schemaParts = original })
	for i, sql := range []string{"INSERT INTO dndshare.source(name) VALUES('unexpected')", "DELETE FROM dndshare.source", "UPDATE dndshare.source SET name='changed'"} {
		schemaParts = append(append([]schemaPart{}, original...), schemaPart{fmt.Sprintf("999_forbidden_%d", i), sql})
		if err := applySchema(t.Context(), pool); err == nil {
			t.Fatal("data migration reached execution")
		}
	}
	var count int
	if err := pool.QueryRow(t.Context(), `SELECT count(*) FROM dndshare.schema_migration`).Scan(&count); err != nil || count != len(original) {
		t.Fatal("rejected data migration changed the ledger", count, err)
	}
}
