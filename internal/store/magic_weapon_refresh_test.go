package store

import (
	"context"
	"encoding/json"
	"github.com/jackc/pgx/v5"
	"os"
	"strings"
	"testing"
)

func TestMagicWeaponRefresh(t *testing.T) {
	dsn := os.Getenv("DNDSHARE_MAGIC_REFRESH_TEST_DSN")
	if dsn == "" {
		t.Skip("set DNDSHARE_MAGIC_REFRESH_TEST_DSN to a disposable local database")
	}
	cfg, err := pgx.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Host != "127.0.0.1" || !strings.HasPrefix(cfg.Database, "dndshare_test_") {
		t.Fatal("requires a disposable local database")
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
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := tx.Exec(ctx, sql, args...); err != nil {
			t.Fatalf("migration SQL: %#v", err)
		}
	}
	check := func(sql string) {
		t.Helper()
		var ok bool
		if err := tx.QueryRow(ctx, sql).Scan(&ok); err != nil || !ok {
			t.Fatalf("%s: %v", sql, err)
		}
	}
	exec(`CREATE SCHEMA dndshare;
 CREATE TABLE dndshare.item(id bigserial PRIMARY KEY,name text,name_en text,type_id bigint,user_id bigint,data jsonb);
 ALTER SEQUENCE dndshare.item_id_seq RESTART WITH 10000;`)
	for _, tag := range []string{"resources", "additions", "links"} {
		var rows []struct {
			ID   int64
			Name string
		}
		if err := json.Unmarshal([]byte(strings.Split(schemaMagicWeaponRefreshSQL, "$"+tag+"$")[1]), &rows); err != nil {
			t.Fatal(err)
		}
		for _, row := range rows {
			exec(`INSERT INTO dndshare.item(id,name,type_id,data) VALUES($1,$2,19,'{"desc":"author","weapon":{"base_item_id":37}}') ON CONFLICT DO NOTHING`, row.ID, row.Name)
		}
	}
	for i, code := range []string{"stunned", "deafened", "poisoned", "prone", "frightened"} {
		exec(`INSERT INTO dndshare.item(id,type_id,data) VALUES($1,15,jsonb_build_object('code',$2::text))`, 9000+i, code)
	}
	exec(`UPDATE dndshare.item SET data=data || '{"weapon_damage":[{"key":"custom","label":"keep"}]}' WHERE id=164;
 UPDATE dndshare.item SET data=data || '{"weapon_damage":[{"key":"disruption","damage_type":8}],"status_effects":[{"key":"authored","effect":{"id":9000},"condition":"keep"}]}' WHERE id=190;
 UPDATE dndshare.item SET data=data || '{"feature_actions":[{"key":"apply_poison","requirements":["Бросок урона ядом выполняется отдельно, без удвоения при крите.","Авторское условие"]}]}' WHERE id=149;
 UPDATE dndshare.item SET data=data || '{"max_use":42}' WHERE id=108;
 UPDATE dndshare.item SET user_id=7 WHERE id=297;
 INSERT INTO dndshare.item(id,name,type_id,data) VALUES(104,'Святой мститель',19,'{"weapon_damage":[{"key":"holy_damage","dice":"d10"}]}');`)
	exec(schemaMagicWeaponRefreshSQL)
	check(`SELECT data#>>'{weapon_damage,1,key}'='power_strike' AND data#>>'{weapon_damage,0,label}'='keep' AND data->>'max_use'='20' FROM dndshare.item WHERE id=164`)
	check(`SELECT jsonb_array_length(data->'use_resources')=5 AND jsonb_array_length(data->'feature_actions')=4 FROM dndshare.item WHERE id=88`)
	check(`SELECT data#>>'{weapon_damage,0,damage_type}'='7' FROM dndshare.item WHERE id=104`)
	check(`SELECT data#>>'{weapon_damage,0,damage_type}'='8' AND jsonb_array_length(data->'status_effects')=2 AND data#>>'{status_effects,0,condition}'='keep' FROM dndshare.item WHERE id=190`)
	check(`SELECT data->>'max_use'='42' AND NOT(data ? 'dawn_recovery') FROM dndshare.item WHERE id=108`)
	check(`SELECT NOT(data ? 'max_use') FROM dndshare.item WHERE id=297`)
	check(`SELECT data->>'desc'='author' AND data#>>'{weapon,base_item_id}'='37' FROM dndshare.item WHERE id=149`)
	check(`SELECT data#>>'{feature_actions,0,requirements,1}'='Авторское условие' AND data#>>'{feature_actions,0,requirements,0}' LIKE '%меню урона%' FROM dndshare.item WHERE id=149`)
	check(`SELECT count(*)=1 FROM dndshare.item WHERE type_id=15 AND data->>'code'='mace_terror'`)
	check(`SELECT count(*)=7 AND bool_and(e.type_id=15 AND link->>'target'='other') FROM dndshare.item i CROSS JOIN LATERAL jsonb_array_elements(i.data->'status_effects') link JOIN dndshare.item e ON e.id=(link#>>'{effect,id}')::bigint WHERE link->>'key'<>'authored'`)
	var before, after string
	read := func(dest *string) {
		t.Helper()
		if err := tx.QueryRow(ctx, `SELECT jsonb_agg(to_jsonb(i) ORDER BY id)::text FROM dndshare.item i`).Scan(dest); err != nil {
			t.Fatal(err)
		}
	}
	read(&before)
	exec(schemaMagicWeaponRefreshSQL)
	read(&after)
	if before != after {
		t.Fatal("refresh is not idempotent")
	}
}
