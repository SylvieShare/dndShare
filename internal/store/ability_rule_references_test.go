package store

import (
	"context"
	"dndshare/internal/testdb"
	"testing"
)

func TestAbilityRuleReferences(t *testing.T) {
	pool := testdb.Pool(t)
	ctx := context.Background()
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
 (1,NULL,4,'Скрытая атака','{"class_ids":[{"id":4015}],"weapon_damage":[{"key":"damage_1_2","label":"Первая","dice":"d6"},{"key":"damage_1","label":"Вторая","dice":"d8"},{"key":"damage_1_3","label":"Третья","dice":"d4"}],"sheet_widgets":[{"value_source":"weapon_damage"}]}'),
 (2,7,18,'Личное','{"weapon_damage":[{"key":"custom","dice":"d6"}],"sheet_widgets":[]}'),
 (3,7,4,'Пустое','{"weapon_damage":null,"class_ids":{}}'),
 (4,7,4,'Явное','{"level_source":"character","class_ids":[{"id":4015}],"weapon_damage":[{"key":"a"},{"key":"b"}],"sheet_widgets":[{"value_source":"weapon_damage","weapon_damage_key":"b"}]}');`)
	defer exec(`DROP SCHEMA dndshare CASCADE`)
	refs, err := (&Store{pool: pool}).FindItemRuleReferences(ctx, nil, 1, 0, "weapon_damage", "Вторая", 40, 0)
	if err != nil || len(refs) != 1 || refs[0].Key != "damage_1" {
		t.Fatalf("typed damage reference: %+v, %v", refs, err)
	}
}
