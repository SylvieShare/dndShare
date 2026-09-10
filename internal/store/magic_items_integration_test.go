package store

import (
	"context"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
)

func TestMagicItemsMigration(t *testing.T) {
	dsn := os.Getenv("DNDSHARE_MAGIC_TEST_DSN")
	if dsn == "" {
		t.Skip("set DNDSHARE_MAGIC_TEST_DSN to an empty local disposable database")
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
	exec(`CREATE SCHEMA dndshare;
CREATE TABLE dndshare.item_type (id bigserial PRIMARY KEY, name text, parent_type_id bigint, source_id bigint, color text, important bool, description text, icon_image_id bigint, cover_image_id bigint, count_items int DEFAULT 0, fields jsonb);
CREATE TABLE dndshare.item (id bigint PRIMARY KEY, name text, type_id bigint, user_id bigint, data jsonb);
CREATE TABLE dndshare.char (id bigint PRIMARY KEY, data jsonb);
CREATE TABLE dndshare.suggest (id bigint, type_id bigint, user_id bigint, value text);
INSERT INTO dndshare.item_type(id,fields) VALUES (2,'[{"key":"desc","type":"description"},{"key":"type","type":"text"},{"key":"weight","type":"float"}]'),
(4,'[{"key":"desc","type":"description"},{"key":"class_ids","type":"object_array"},{"key":"feature_actions","type":"object_array","fields":[{"key":"key","type":"text"}]},{"key":"max_use","type":"int"}]'),
(12,'[{"key":"category","type":"text"}]');
INSERT INTO dndshare.item VALUES
(95,'Волшебная палочка огненных шаров',2,NULL,'{"desc":"keep","weight":0.2}'),
(103,'Плащ защиты',2,NULL,'{"desc":"keep"}'),
(265,'Свиток заклинания',2,NULL,'{"rarity":0}'),
(1423,'Кожанная броня (+1)',2,NULL,'{}'),
(344,'Счёты',2,NULL,'{"rarity":0}'),
(340,'Неподвижный жезл',2,7,'{}'),
(75,'Изменённая запись',2,NULL,'{}');
INSERT INTO dndshare.suggest VALUES (901,3,NULL,'Лёгкие доспехи');
INSERT INTO dndshare.char VALUES (1,'{"values":{"untouched":42,"items":{"equipped":[{"uid":"cloak","item_id":103,"count":1}],"sections":[{"id":"bag","name":"Мешок","items":[{"uid":"wand","item_id":95,"count":2,"params":{"note":"keep"}},{"uid":"gear","item_id":344,"count":3}]}]}}}');`)
	exec(schemaMagicItemsSQL)
	check := func(sql string) {
		t.Helper()
		var ok bool
		if err := tx.QueryRow(ctx, sql).Scan(&ok); err != nil || !ok {
			t.Fatalf("migration invariant failed: %s: %v", sql, err)
		}
	}
	check(`SELECT count(*)=4 FROM dndshare.item WHERE type_id=19`)
	check(`SELECT bool_and(type_id=2) FROM dndshare.item WHERE id IN (344,340,75)`)
	check(`SELECT data->>'desc'='keep' AND data->>'weight'='0.2' AND data->>'attunement'='required' AND data->>'max_use'='7' AND NOT (data ? 'rollback_long_rest') FROM dndshare.item WHERE id=95`)
	check(`SELECT data->>'rarity'='0' AND data->>'attunement'='none' FROM dndshare.item WHERE id=265`)
	check(`SELECT data->>'required_armor_proficiency'='901' AND data#>>'{armor,ac}'='12' FROM dndshare.item WHERE id=1423`)
	check(`SELECT (SELECT f FROM dndshare.item_type,jsonb_array_elements(fields) f WHERE id=19 AND f->>'key'='feature_actions')=(SELECT f FROM dndshare.item_type,jsonb_array_elements(fields) f WHERE id=4 AND f->>'key'='feature_actions')`)
	check(`SELECT NOT EXISTS (SELECT f->>'key' FROM dndshare.item_type,jsonb_array_elements(fields) f WHERE id=19 GROUP BY f->>'key' HAVING count(*)>1)`)
	check(`SELECT count_items=4 AND parent_type_id=2 FROM dndshare.item_type WHERE id=19`)
	check(`SELECT data#>>'{values,untouched}'='42' AND data#>>'{values,items,sections,0,name}'='Мешок' AND jsonb_array_length(data#>'{values,items,sections,0,items}')=3 FROM dndshare.char WHERE id=1`)
	check(`SELECT data#>>'{values,items,sections,0,items,0,uid}'='wand' AND data#>>'{values,items,sections,0,items,1,uid}'='wand-magic-2' AND data#>>'{values,items,sections,0,items,1,params,note}'='keep' AND data#>>'{values,items,sections,0,items,2,count}'='3' FROM dndshare.char WHERE id=1`)
	check(`SELECT nextval(pg_get_serial_sequence('dndshare.item_type','id'))>19`)

	// Exercise the next migration against the actual magic-items schema it extends.
	exec(`INSERT INTO dndshare.item_type(id,fields) VALUES (1,'[]'),(10,'[]'),(13,'[]'),(14,'[]');
INSERT INTO dndshare.item VALUES
(223,'Оружие',19,NULL,'{"rarity":1,"desc":"keep"}'),
(263,'Солнечный клинок',19,NULL,'{"rarity":2}'),
(200,'Топор берсерка',19,7,'{"rarity":2}'),
(35,'Дубинка',1,NULL,'{"available_in_starting_shop":true}'),
(36,'Кинжал',1,7,'{"available_in_starting_shop":true}'),
(3000,'Артефакт',19,NULL,'{"rarity":5}'),
(3001,'Лодка',13,NULL,'{"available_in_starting_shop":true}');`)
	exec(schemaMasterToolsSQL)
	check(`SELECT data#>>'{weapon,magic_bonus}'='1' AND data->>'desc'='keep' AND NOT (data->'weapon' ? 'base_item_id') AND data#>>'{treasure,min_level}'='1' FROM dndshare.item WHERE id=223`)
	check(`SELECT data#>>'{weapon,base_item_id}'='49' AND data#>>'{weapon,damage_type}'='7' AND data#>>'{treasure,min_level}'='5' FROM dndshare.item WHERE id=263`)
	check(`SELECT bool_and(NOT (data ? 'weapon') AND NOT (data ? 'treasure')) FROM dndshare.item WHERE id IN (200,36,3000,3001)`)
	check(`SELECT data->>'available_in_starting_shop'='true' AND data#>>'{treasure,weight}'='10' FROM dndshare.item WHERE id=35`)
	check(`SELECT count(*)=7 FROM dndshare.item_type,jsonb_array_elements(fields) f WHERE f->>'key'='treasure'`)
	check(`SELECT NOT EXISTS (SELECT id,f->>'key' FROM dndshare.item_type,jsonb_array_elements(fields) f GROUP BY id,f->>'key' HAVING count(*)>1)`)
}
