package store

import (
	"context"
	"encoding/json"
	"os"
	"reflect"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestAbilityRuleLinksMigration(t *testing.T) {
	dsn := os.Getenv("DNDSHARE_ABILITY_LINK_TEST_DSN")
	if dsn == "" {
		t.Skip("set DNDSHARE_ABILITY_LINK_TEST_DSN to an empty local dndshare_test_* database")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(cfg.ConnConfig.Database, "dndshare_test_") || (cfg.ConnConfig.Host != "localhost" && cfg.ConnConfig.Host != "127.0.0.1") {
		t.Fatal("requires a disposable local database")
	}
	ctx := context.Background()
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := pool.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	exec(`CREATE SCHEMA dndshare;
 CREATE TABLE dndshare.item_type(id bigint PRIMARY KEY, fields jsonb);
 CREATE TABLE dndshare.item(id bigint PRIMARY KEY, user_id bigint, type_id bigint, name text, data jsonb);
 INSERT INTO dndshare.item VALUES
 (1,NULL,4,'Скрытая атака','{"class_ids":[{"id":4015}],"weapon_damage":[{"label":"Первая","dice":"d6"},{"key":"damage_1","label":"Вторая","dice":"d8"},{"key":"damage_1","label":"Третья","dice":"d4"}],"sheet_widgets":[{"value_source":"weapon_damage"}]}'),
 (2,7,18,'Личное','{"weapon_damage":[{"key":"custom","dice":"d6"}],"sheet_widgets":[]}'),
 (3,7,4,'Пустое','{"weapon_damage":null,"class_ids":{}}'),
 (4,7,4,'Явное','{"level_source":"character","class_ids":[{"id":4015}],"weapon_damage":[{"key":"a"},{"key":"b"}],"sheet_widgets":[{"value_source":"weapon_damage","weapon_damage_key":"b"}]}');`)
	defer exec(`DROP SCHEMA dndshare CASCADE`)
	snapshot := strings.Split(schemaStoryAbilitiesSQL, "$abilities$")[1]
	exec(`INSERT INTO dndshare.item_type SELECT n,$1::jsonb FROM unnest(ARRAY[3,4,18]) n`, snapshot)
	exec(schemaAbilityEditorDamageSQL)
	exec(schemaAbilityRuleLinksSQL)
	var valid bool
	err = pool.QueryRow(ctx, `SELECT
 (SELECT data->'weapon_damage'->0->>'key'='damage_1_2' AND data->'sheet_widgets'->0->>'weapon_damage_key'='damage_1_2' AND data->>'level_source'='class' AND data->>'level_class_id'='4015' FROM dndshare.item WHERE id=1)
 AND (SELECT COUNT(DISTINCT rule->>'key')=3 FROM dndshare.item CROSS JOIN LATERAL jsonb_array_elements(data->'weapon_damage') rule WHERE id=1)
 AND (SELECT data->'sheet_widgets'='[]'::jsonb AND data->'weapon_damage'->0->>'key'='custom' FROM dndshare.item WHERE id=2)
 AND (SELECT data->>'level_source'='bound' FROM dndshare.item WHERE id=3)
 AND (SELECT data->>'level_source'='character' AND data->'sheet_widgets'->0->>'weapon_damage_key'='b' FROM dndshare.item WHERE id=4)`).Scan(&valid)
	if err != nil || !valid {
		t.Fatalf("link migration failed: valid=%v err=%v", valid, err)
	}
	for _, id := range []string{"3", "4", "18"} {
		var actual json.RawMessage
		if err := pool.QueryRow(ctx, `SELECT fields FROM dndshare.item_type WHERE id=$1`, id).Scan(&actual); err != nil {
			t.Fatal(err)
		}
		expected, err := os.ReadFile("../../resources/items/item_" + id + "_shema.json")
		if err != nil {
			t.Fatal(err)
		}
		var a, b any
		if err := json.Unmarshal(actual, &a); err != nil {
			t.Fatal(err)
		}
		if err := json.Unmarshal(expected, &b); err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(a, b) {
			t.Fatalf("migrated schema %s differs from current resource", id)
		}
	}
	refs, err := (&Store{pool: pool}).FindItemRuleReferences(ctx, nil, 1, 0, "weapon_damage", "Вторая", 40, 0)
	if err != nil || len(refs) != 1 || refs[0].Key != "damage_1" {
		t.Fatalf("typed damage reference: %+v, %v", refs, err)
	}
}
