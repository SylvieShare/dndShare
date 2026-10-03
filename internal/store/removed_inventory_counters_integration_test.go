package store

import (
	"encoding/json"
	"errors"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestRemovedInventoryCountersPostgres(t *testing.T) {
	dsn := os.Getenv("DNDSHARE_PACKAGING_TEST_DSN")
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
CREATE TABLE dndshare."char"(id bigint PRIMARY KEY,data jsonb,version bigint DEFAULT 3,
 deleted boolean DEFAULT false,changed_at timestamptz);
CREATE TABLE dndshare.inventory_counter_migration(
 char_id bigint,counter_id text,original_counter jsonb,created_entry jsonb,
 section_id text,previous_version bigint,action text,inventory_before jsonb,inventory_after jsonb,
 PRIMARY KEY(char_id,counter_id));
INSERT INTO dndshare."char"(id,data,deleted) VALUES
(1,'{"values":{"counters":[],"resources":[{"title":"manual","value":3}],"items":{"sections":[{"id":"bag","items":[{"uid":"ration","item_id":420,"count":10}]}]}}}',false),
(2,'{"values":{"counters":null,"money":{"amounts":{"3":10}}}}',false),
(3,'{"values":{"items":{"equipped":[]}}}',false),
(45,'{"values":{"counters":[{"id":"legacy","name":"Стрелы","value":13}],"items":{"sections":[{"id":"bag","items":[{"uid":"kept","item_id":442,"count":1}]}]}}}',true);`)
	exec(schemaRemovedInventoryCountersSQL)
	var stillStored, receipts int
	pool.QueryRow(t.Context(), `SELECT count(*) FROM dndshare."char" WHERE (data->'values') ? 'counters'`).Scan(&stillStored)
	pool.QueryRow(t.Context(), "SELECT count(*) FROM dndshare.inventory_counter_migration").Scan(&receipts)
	if stillStored != 0 || receipts != 2 {
		t.Fatalf("retirement: stored=%d audit=%d", stillStored, receipts)
	}
	var raw, inventoryBefore, inventoryAfter []byte
	var previousVersion int
	if err := pool.QueryRow(t.Context(), "SELECT original_counter,previous_version,inventory_before,inventory_after FROM dndshare.inventory_counter_migration WHERE char_id=45").Scan(&raw, &previousVersion, &inventoryBefore, &inventoryAfter); err != nil {
		t.Fatal(err)
	}
	var original map[string]any
	if err := json.Unmarshal(raw, &original); err != nil {
		t.Fatal(err)
	}
	if previousVersion != 3 || original["path"] != "values.counters" || len(original["value"].([]any)) != 1 ||
		string(inventoryBefore) != string(inventoryAfter) {
		t.Fatal("remaining deleted-character tiles must be archived without changing its inventory")
	}
	var preserved bool
	if err := pool.QueryRow(t.Context(), `SELECT data#>>'{values,items,sections,0,items,0,count}'='10'
 AND data#>>'{values,resources,0,value}'='3' FROM dndshare."char" WHERE id=1`).Scan(&preserved); err != nil || !preserved {
		t.Fatalf("items and resources changed: %v %v", preserved, err)
	}
	for _, id := range []int{1, 2, 3, 45} {
		var version int
		var deleted bool
		pool.QueryRow(t.Context(), `SELECT version,deleted FROM dndshare."char" WHERE id=$1`, id).Scan(&version, &deleted)
		want := 4
		if id == 3 {
			want = 3
		}
		if version != want || deleted != (id == 45) {
			t.Fatalf("character %d: version=%d deleted=%v", id, version, deleted)
		}
	}
	rejected := func(sql string, args ...any) {
		t.Helper()
		_, err := pool.Exec(t.Context(), sql, args...)
		var pgErr *pgconn.PgError
		if !errors.As(err, &pgErr) || pgErr.Code != "23514" || pgErr.ConstraintName != "character_without_inventory_counters" {
			t.Fatalf("removed tiles must fail at storage boundary: %v", err)
		}
	}
	for _, value := range []string{`[]`, `null`, `[{"id":"new","value":1}]`} {
		rejected(`UPDATE dndshare."char" SET data=jsonb_set(data,'{values,counters}',$1::jsonb) WHERE id=1`, value)
	}
	rejected(`INSERT INTO dndshare."char"(id,data) VALUES(100,'{"values":{"counters":[]}}')`)
	rejected(`UPDATE dndshare."char" SET data='{"values":{"counters":[]}}' WHERE id=1`)
	exec(schemaRemovedInventoryCountersSQL)
	var version int
	pool.QueryRow(t.Context(), `SELECT version FROM dndshare."char" WHERE id=45`).Scan(&version)
	if version != 4 {
		t.Fatal("repeat retirement must not change the version")
	}
}
