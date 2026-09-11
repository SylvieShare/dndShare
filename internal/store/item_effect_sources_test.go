package store

import (
	"context"
	"encoding/json"
	"os"
	"reflect"
	"strconv"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestWeaponChargesMigrationAndEffectSources(t *testing.T) {
	dsn := os.Getenv("DNDSHARE_EFFECT_SOURCES_TEST_DSN")
	if dsn == "" {
		t.Skip("set DNDSHARE_EFFECT_SOURCES_TEST_DSN to an empty local dndshare_test_* database")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(cfg.ConnConfig.Database, "dndshare_test_") || cfg.ConnConfig.Host != "127.0.0.1" {
		t.Fatal("requires a disposable local test database")
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
 CREATE TABLE dndshare.item_type(id bigint PRIMARY KEY,fields jsonb);
 CREATE TABLE dndshare.item(id bigserial PRIMARY KEY,user_id bigint,name text,name_en text,type_id bigint,data jsonb);
 ALTER SEQUENCE dndshare.item_id_seq RESTART WITH 9000;
 INSERT INTO dndshare.item(id,name,type_id,data) VALUES(86,'Посох иссушения',19,'{"desc":"keep","weapon":{"base_item_id":37},"attunement":"required","feature_actions":[{"key":"keep"}]}');`)
	defer exec(`DROP SCHEMA dndshare CASCADE`)
	added := map[string]map[string]bool{"weapon_damage": {"damage_type": true, "uses_resource": true, "resource_key": true, "resource_cost": true}, "status_effects": {"target": true, "condition": true, "weapon_damage_key": true}}
	for _, id := range []int{3, 4, 5, 7, 18, 19} {
		content, err := os.ReadFile("../../resources/items/item_" + strconv.Itoa(id) + "_shema.json")
		if err != nil {
			t.Fatal(err)
		}
		var fields []map[string]any
		if err = json.Unmarshal(content, &fields); err != nil {
			t.Fatal(err)
		}
		for _, field := range fields {
			if keys, ok := added[field["key"].(string)]; ok {
				var keep []any
				for _, raw := range field["fields"].([]any) {
					if !keys[raw.(map[string]any)["key"].(string)] {
						keep = append(keep, raw)
					}
				}
				field["fields"] = keep
			}
		}
		baseline, _ := json.Marshal(fields)
		exec(`INSERT INTO dndshare.item_type VALUES($1,$2::jsonb)`, id, baseline)
	}
	exec(schemaWeaponChargesEffectsSQL)
	var once string
	if err = pool.QueryRow(ctx, `SELECT data::text FROM dndshare.item WHERE id=86`).Scan(&once); err != nil {
		t.Fatal(err)
	}
	exec(schemaWeaponChargesEffectsSQL)
	var twice string
	_ = pool.QueryRow(ctx, `SELECT data::text FROM dndshare.item WHERE id=86`).Scan(&twice)
	if once != twice {
		t.Fatal("migration is not idempotent")
	}
	for _, id := range []int{3, 4, 5, 7, 18, 19} {
		var actualBytes []byte
		if err = pool.QueryRow(ctx, `SELECT fields FROM dndshare.item_type WHERE id=$1`, id).Scan(&actualBytes); err != nil {
			t.Fatal(err)
		}
		expectedBytes, _ := os.ReadFile("../../resources/items/item_" + strconv.Itoa(id) + "_shema.json")
		var actual, expected any
		_ = json.Unmarshal(actualBytes, &actual)
		_ = json.Unmarshal(expectedBytes, &expected)
		if !reflect.DeepEqual(actual, expected) {
			t.Fatalf("schema snapshot %d differs from applied migration", id)
		}
	}
	var staff map[string]any
	_ = json.Unmarshal([]byte(once), &staff)
	if staff["desc"] != "keep" || staff["max_use"] != float64(3) || len(staff["feature_actions"].([]any)) != 1 {
		t.Fatal("staff data was lost or charges were not created")
	}
	link := staff["status_effects"].([]any)[0].(map[string]any)
	effectID := int64(link["effect"].(map[string]any)["id"].(float64))
	damage := staff["weapon_damage"].([]any)[0].(map[string]any)
	if damage["dice_count"] != float64(2) || damage["damage_type"] != float64(10) || damage["resource_cost"] != float64(1) || link["target"] != "other" {
		t.Fatal("wrong staff mechanics")
	}
	s := &Store{pool: pool}
	search := func(user *int64, id int64, limit, offset int) []ItemEffectSource {
		t.Helper()
		rows, err := s.FindItemEffectSources(ctx, user, id, limit, offset)
		if err != nil {
			t.Fatal(err)
		}
		return rows
	}
	if rows := search(nil, effectID, 40, 0); len(rows) != 1 || rows[0].ItemID != 86 || rows[0].Target != "other" {
		t.Fatalf("staff source: %+v", rows)
	}
	payload := `{"status_effects":[{"effect":{"id":` + strconv.FormatInt(effectID, 10) + `},"condition":"condition"}]}`
	exec(`INSERT INTO dndshare.item(id,user_id,name,type_id,data) VALUES(1,7,'A own',4,$1::jsonb),(2,8,'B private',5,$1::jsonb),(3,NULL,'C public',2,$1::jsonb)`, payload)
	exec(`INSERT INTO dndshare.item(id,name,type_id,data) VALUES(4,'bad array',2,'{"status_effects":{}}'),(5,'bad elements',2,'{"status_effects":[null,17,"str",{"effect":"not-an-id"}]}')`)
	user := int64(7)
	if len(search(nil, effectID, 40, 0)) != 2 || len(search(&user, effectID, 40, 0)) != 3 {
		t.Fatal("source visibility mismatch")
	}
	first, second := search(&user, effectID, 1, 0), search(&user, effectID, 1, 1)
	if len(first) != 1 || len(second) != 1 || first[0].ItemID == second[0].ItemID {
		t.Fatal("pagination does not advance")
	}
	exec(`UPDATE dndshare.item SET user_id=8 WHERE id=$1`, effectID)
	if len(search(&user, effectID, 40, 0)) != 0 {
		t.Fatal("private effect leaked")
	}
	exec(`UPDATE dndshare.item SET user_id=NULL WHERE id=$1`, effectID)
	exec(`UPDATE dndshare.item SET data='{}' WHERE id=3; DELETE FROM dndshare.item WHERE id=1;`)
	if len(search(&user, effectID, 40, 0)) != 1 {
		t.Fatal("stale sources after edit and deletion")
	}
	exec(`UPDATE dndshare.item SET user_id=7,data='{"keep":"custom"}' WHERE id=86`)
	exec(schemaWeaponChargesEffectsSQL)
	var custom string
	_ = pool.QueryRow(ctx, `SELECT data->>'keep' FROM dndshare.item WHERE id=86`).Scan(&custom)
	if custom != "custom" {
		t.Fatal("migration changed custom item")
	}
}
