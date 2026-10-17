package store

import (
	"os"
	"sort"
	"strings"
	"testing"
)

func TestSchemaFilesAreStructuralAndOrdered(t *testing.T) {
	files, err := os.ReadDir("schema")
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	for _, file := range files {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".sql") {
			names = append(names, strings.TrimSuffix(file.Name(), ".sql"))
		}
	}
	sort.Strings(names)
	if len(names) != len(schemaParts) {
		t.Fatalf("migration registry has %d entries for %d SQL files", len(schemaParts), len(names))
	}
	for i, part := range schemaParts {
		if part.name != names[i] {
			t.Fatalf("migration order: got %s, want %s", part.name, names[i])
		}
		if err := validateSchemaDDL(part.sql); err != nil {
			t.Fatalf("%s contains a nonstructural operation: %v", part.name, err)
		}
	}
	if err := validateStructuralBaseline(); err != nil {
		t.Fatal(err)
	}
}

func TestSchemaDDLGuard(t *testing.T) {
	allowed := []string{
		`CREATE TABLE t(id bigint GENERATED ALWAYS AS IDENTITY, label text DEFAULT '; INSERT INTO x VALUES(1)');`,
		`/* nested /* INSERT x */ comment */ ALTER TABLE t ADD COLUMN "AS" text; -- DELETE x`,
		`CREATE FUNCTION f() RETURNS TABLE(id bigint) LANGUAGE sql AS $$ SELECT id FROM t; $$;`,
		`CREATE OR REPLACE FUNCTION f() RETURNS trigger LANGUAGE plpgsql AS $body$ BEGIN INSERT INTO t VALUES(NEW.id); RETURN NEW; END; $body$;`,
		`CREATE FUNCTION f() RETURNS text LANGUAGE sql AS 'SELECT ''UPDATE; DELETE''';`,
		`CREATE VIEW v AS SELECT id FROM t; COMMENT ON VIEW v IS 'seed; UPDATE';`,
		`CREATE MATERIALIZED VIEW v AS SELECT id FROM t WITH NO DATA;`,
		`ALTER SEQUENCE seq OWNED BY t.id; CREATE INDEX i ON t(id);`,
		`-- comment only`,
	}
	for _, sql := range allowed {
		if err := validateSchemaDDL(sql); err != nil {
			t.Errorf("structural DDL rejected: %s: %v", sql, err)
		}
	}
	rejected := []string{
		`INSERT INTO t VALUES(1);`,
		"-- migration\nUPDATE t SET id=1;",
		`DELETE FROM t;`,
		`TRUNCATE t;`,
		`COPY t FROM STDIN;`,
		`MERGE INTO t USING s ON t.id=s.id WHEN MATCHED THEN DELETE;`,
		`WITH removed AS (DELETE FROM t RETURNING *) SELECT * FROM removed;`,
		`DO $$ BEGIN UPDATE t SET id=1; END; $$;`,
		`CALL backfill();`,
		`SELECT seed_catalogue();`,
		`CREATE TABLE t AS SELECT 1 AS id;`,
		`CREATE UNLOGGED TABLE t(id) AS SELECT 1;`,
		`CREATE SCHEMA s CREATE TABLE t AS SELECT 1;`,
		`CREATE MATERIALIZED VIEW v AS SELECT 1;`,
		`ALTER SEQUENCE seq RESTART WITH 1;`,
		`CREATE TABLE t(label text DEFAULT 'UPDATE;'); DELETE FROM t;`,
		`CREATE TABLE t(label text DEFAULT E'it\'s; INSERT'); UPDATE t SET label='changed';`,
		`CREATE FUNCTION f() RETURNS void AS $$ SELECT 1; $$ LANGUAGE sql; INSERT INTO t VALUES(1);`,
		`CREATE TABLE t(id int); /* unfinished`,
		`CREATE TABLE t(label text DEFAULT 'unfinished);`,
		`CREATE FUNCTION f() RETURNS void AS $tag$ unfinished;`,
	}
	for _, sql := range rejected {
		if err := validateSchemaDDL(sql); err == nil {
			t.Errorf("nonstructural or malformed SQL accepted: %s", sql)
		}
	}
}
