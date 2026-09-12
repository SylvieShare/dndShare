package store

import (
	"context"
	"fmt"
	"os"
	"reflect"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestEffectSourceFilter(t *testing.T) {
	dsn := os.Getenv("DNDSHARE_EFFECT_FILTER_TEST_DSN")
	if dsn == "" {
		t.Skip("set DNDSHARE_EFFECT_FILTER_TEST_DSN to a disposable local dndshare_test_* database")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Host != "127.0.0.1" || !strings.HasPrefix(cfg.ConnConfig.Database, "dndshare_test_") {
		t.Fatal("requires a disposable local test database")
	}
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
	exec(`CREATE SCHEMA dndshare;
 CREATE TABLE dndshare.item_type(id bigint PRIMARY KEY, fields jsonb);
 INSERT INTO dndshare.item_type VALUES(15,'[]');
 CREATE TABLE dndshare.item(id bigint PRIMARY KEY, type_id bigint, user_id bigint, data jsonb);
 INSERT INTO dndshare.item VALUES
 (1,15,NULL,'{"code":"unconscious"}'), (2,15,NULL,'{"code":"deafened"}'),
 (3,15,NULL,'{"code":"shield_of_faith"}'), (4,15,NULL,'{"code":"withering"}'),
 (5,15,NULL,'{"code":"rage"}'), (6,15,NULL,'{"code":"inspiration"}'),
 (10,5,NULL,'{"status_effects":[{"effect":{"id":3}},{"effect":1}]}'),
 (11,19,NULL,'{"status_effects":[{"effect":{"id":4}},{"effect":1}]}'),
 (12,5,7,'{"status_effects":[{"effect":2}]}'),
 (13,5,8,'{"status_effects":[{"effect":5}]}'),
 (14,19,NULL,'{"status_effects":{}}'),
 (15,19,NULL,'{"status_effects":[null,17,"str",{"effect":"bad"}]}');`)
	defer exec(`DROP SCHEMA dndshare CASCADE`)
	exec(schemaEffectSourceFilterSQL)
	exec(schemaEffectSourceFilterSQL)
	var count int
	if err := pool.QueryRow(ctx, `SELECT jsonb_array_length(fields) FROM dndshare.item_type WHERE id=15`).Scan(&count); err != nil || count != 1 {
		t.Fatalf("filter metadata must be added once: count=%d err=%v", count, err)
	}
	check := func(userID *int64, values []any, expected []int64) {
		t.Helper()
		args := []any{}
		predicate := effectSourceFilterSQL(values, userID, func(value any) string {
			args = append(args, value)
			return fmt.Sprintf("$%d", len(args))
		})
		rows, err := pool.Query(ctx, "SELECT i.id FROM dndshare.item i WHERE i.type_id=15 AND "+predicate+" ORDER BY i.id", args...)
		if err != nil {
			t.Fatal(err)
		}
		defer rows.Close()
		actual := []int64{}
		for rows.Next() {
			var id int64
			if err := rows.Scan(&id); err != nil {
				t.Fatal(err)
			}
			actual = append(actual, id)
		}
		if err := rows.Err(); err != nil || !reflect.DeepEqual(actual, expected) {
			t.Fatalf("filter %v: got %v, want %v, err=%v", values, actual, expected, err)
		}
	}
	check(nil, []any{"basic"}, []int64{1, 2, 6})
	check(nil, []any{"spell"}, []int64{1, 3})
	check(nil, []any{"magic_item"}, []int64{1, 4})
	check(nil, []any{"spell", "magic_item"}, []int64{1, 3, 4})
	check(nil, []any{"basic", "spell"}, []int64{1, 2, 3, 6})
	check(nil, []any{"unknown"}, []int64{})
	userID := int64(7)
	check(&userID, []any{"spell"}, []int64{1, 2, 3})
	exec(`UPDATE dndshare.item SET data='{}' WHERE id=10; DELETE FROM dndshare.item WHERE id=11`)
	check(nil, []any{"spell", "magic_item"}, []int64{})
}
