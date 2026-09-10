package store

import (
	"context"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestAbilityEditorDamageMigration(t *testing.T) {
	dsn := os.Getenv("DNDSHARE_ABILITY_EDITOR_TEST_DSN")
	if dsn == "" {
		t.Skip("set DNDSHARE_ABILITY_EDITOR_TEST_DSN to a disposable local dndshare_test_* database")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(cfg.ConnConfig.Database, "dndshare_test_") || (cfg.ConnConfig.Host != "127.0.0.1" && cfg.ConnConfig.Host != "localhost") {
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
 CREATE TABLE dndshare.item_type(id bigint, fields jsonb);
 CREATE TABLE dndshare.item(id bigint, user_id bigint, type_id bigint, name text, data jsonb);
 INSERT INTO dndshare.item_type VALUES (4, '[{"key":"weapon_damage","fields":[{"key":"dice"},{"key":"menu_label"},{"key":"critical_menu_label"}]}]');
 INSERT INTO dndshare.item VALUES (1,NULL,4,'Скрытая атака','{"weapon_damage":[{"dice":"d6","dice_count_level_divisor":2,"dice_count_rounding":"up","menu_label":"старое"}]}'),
 (2,NULL,4,'Ярость','{"scaling":[{"level":1,"uses":2,"value":"+2"},{"level":20,"uses":0,"value":"+4, без ограничений"}]}'),
 (3,7,4,'Личное','{"weapon_damage":null}'),(4,7,4,'Пустое','{"weapon_damage":{}}');
 UPDATE dndshare.item SET data=data || jsonb_build_object(
 'scaling',(SELECT jsonb_agg(jsonb_build_object('level', lvl, 'value', ((lvl+1)/2)::text || 'к6')) FROM generate_series(1,19,2) lvl),
 'display_scaling',(SELECT jsonb_agg(jsonb_build_object('level', lvl, 'label', ((lvl+1)/2)::text || 'к6')) FROM generate_series(1,19,2) lvl)) WHERE id=1;
 INSERT INTO dndshare.item SELECT 5,NULL,type_id,name,jsonb_set(data,'{scaling,0,value}','"Другая формула"') FROM dndshare.item WHERE id=1;`)
	defer exec(`DROP SCHEMA dndshare CASCADE`)
	exec(schemaAbilityEditorDamageSQL)
	var valid bool
	err = pool.QueryRow(ctx, `SELECT
 NOT (SELECT data ? 'scaling' OR data ? 'display_scaling' FROM dndshare.item WHERE id=1)
 AND (SELECT data->'weapon_damage'->0->>'dice_count_level_divisor' = '2' FROM dndshare.item WHERE id=1)
 AND (SELECT data->'scaling'->1->>'value' = '+4' AND data->'scaling'->1->>'uses' = '0' FROM dndshare.item WHERE id=2)
 AND (SELECT data->'scaling'->0->>'value' = 'Другая формула' FROM dndshare.item WHERE id=5)
 AND (SELECT fields->0->'fields' = '[{"key":"dice"}]'::jsonb FROM dndshare.item_type WHERE id=4)
 AND NOT (SELECT data->'weapon_damage'->0 ? 'menu_label' FROM dndshare.item WHERE id=1)`).Scan(&valid)
	if err != nil || !valid {
		t.Fatalf("migration changed calculation or failed to remove duplication: valid=%v err=%v", valid, err)
	}
}
