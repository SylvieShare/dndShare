package store

import (
	"encoding/json"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestResolvedInventoryCountersPostgres(t *testing.T) {
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
CREATE TABLE dndshare.item(id bigint PRIMARY KEY,data jsonb);
CREATE TABLE dndshare."char"(id bigint PRIMARY KEY,uuid uuid,deleted boolean DEFAULT false,
 data jsonb NOT NULL,version bigint DEFAULT 10,changed_at timestamptz);`)
	exec(schemaInventoryCounterMigrationSQL)
	exec(`INSERT INTO dndshare.item VALUES(447,'{"contents":[
 {"item_id":354,"count":1,"params":{}},{"item_id":358,"count":1,"params":{}},
 {"item_id":375,"count":2,"params":{}},{"item_id":367,"count":5,"params":{}},
 {"item_id":420,"count":5,"params":{}},{"item_id":442,"count":1,"params":{}},
 {"item_id":393,"count":1,"params":{}}]}');
INSERT INTO dndshare."char"(id,uuid,data,deleted) VALUES
(5,'d42188e0-cc1b-4375-8af7-5d638bbd179d',
 '{"values":{"counters":[{"id":"cnt3l3g8","name":"Бурдюк","value":2}]}}',false),
(29,'8a705fca-08ae-4ef9-b8fd-73faa9245413',
 '{"values":{"counters":[{"id":"cnt3320g","name":"Сухпайки","value":10},{"id":"cnt435o8","name":"2352","value":0},{"id":"cnt5gc16","name":"23532","value":0}],
 "items":{"equipped":[{"uid":"water","item_id":442,"count":1}],"sections":[{"id":"bag","items":[{"uid":"eq_3","item_id":null,"count":1,"params":{},"override":{"name":"Набор артиста","desc":"<p>Пометка</p>"}}],"slots":{"eq_3":0,"water":2}}]}}}',false),
(32,'5a1d477f-59f3-4be5-ab8a-bfedb0f85de8',
 '{"values":{"resources":[{"title":"manual","value":3}],"counters":[{"id":"cnt125vf","name":"dfcghjk","value":7,"max":7}],
 "items":{"equipped":[],"sections":[{"id":"bag","items":[{"uid":"keep","override":{"name":"Дубинка"},"params":{"custom":7}}]}]}}}',false),
(40,'07ae13a7-83ca-44a9-a9f6-ef7dbe1b3695',
 '{"values":{"counters":[{"id":"cnt2i085","name":"Сухой паёк","value":3},{"id":"cnt5h6ny","name":"Деревянный элемент с кружкой эля","value":1}],
 "items":{"equipped":[{"uid":"worn","item_id":12,"count":1}],"sections":[{"id":"stage","items":[{"uid":"eq_0","item_id":447,"count":1,"params":{},"override":null},{"uid":"costume","item_id":375,"count":1},{"uid":"gift","item_id":4565,"count":1}],
 "slots":{"eq_0":3,"costume":0,"gift":4,"worn":2}},{"id":"other","items":[{"uid":"other","item_id":367,"count":1}],"slots":{"other":0}}]}}}',false),
(45,'3e01e5e5-e7ad-414f-a644-8f9299f6763f',
 '{"values":{"counters":[{"id":"cnt277mg","name":"Стрелы","value":13}]}}',true);`)
	read := func(id int) map[string]any {
		t.Helper()
		var raw []byte
		if err := pool.QueryRow(t.Context(), `SELECT data FROM dndshare."char" WHERE id=$1`, id).Scan(&raw); err != nil {
			t.Fatal(err)
		}
		var doc map[string]any
		if err := json.Unmarshal(raw, &doc); err != nil {
			t.Fatal(err)
		}
		return doc["values"].(map[string]any)
	}
	before45, _ := json.Marshal(read(45))
	before32Inventory, _ := json.Marshal(read(32)["items"])
	exec(schemaResolvedInventoryCountersSQL)
	for _, id := range []int{5, 29, 32, 40} {
		if len(read(id)["counters"].([]any)) != 0 {
			t.Fatalf("resolved counters remain for character %d", id)
		}
	}
	items := func(id int) []any {
		return read(id)["items"].(map[string]any)["sections"].([]any)[0].(map[string]any)["items"].([]any)
	}
	if items(5)[0].(map[string]any)["count"] != float64(2) || items(5)[0].(map[string]any)["item_id"] != float64(442) {
		t.Fatal("two waterskins must be two vessels")
	}
	custom := items(29)[0].(map[string]any)["override"].(map[string]any)
	if len(items(29)) != 2 || items(29)[1].(map[string]any)["count"] != float64(10) ||
		custom["name"] != "Набор артиста (без пайков)" || !strings.Contains(custom["desc"].(string), "Пометка") {
		t.Fatal("custom pack must exclude rations, preserve notes and invent no contents")
	}
	counts := map[int]float64{}
	for _, raw := range items(40) {
		item := raw.(map[string]any)
		if item["item_id"] != nil {
			counts[int(item["item_id"].(float64))] += item["count"].(float64)
		} else if item["override"].(map[string]any)["name"] != "Деревянный элемент с кружкой эля" {
			t.Fatal("simplified story item name changed")
		}
	}
	want := map[int]float64{354: 1, 358: 1, 375: 3, 367: 5, 420: 3, 442: 1, 393: 1, 4565: 1}
	if len(counts) != len(want) {
		t.Fatalf("unexpected unpacked components: %v", counts)
	}
	for id, quantity := range want {
		if counts[id] != quantity {
			t.Fatalf("item %d: got %v, want %v", id, counts[id], quantity)
		}
	}
	section := read(40)["items"].(map[string]any)["sections"].([]any)[0].(map[string]any)
	slots := section["slots"].(map[string]any)
	if slots["eq_0"] != float64(3) || slots["gift"] != float64(4) || slots["worn"] != float64(2) ||
		slots["counter-40-cnt2i085"] != float64(1) || items(40)[0].(map[string]any)["uid"] != "eq_0" {
		t.Fatal("pack backpack must retain its cell; rations fill a free cell")
	}
	after32Inventory, _ := json.Marshal(read(32)["items"])
	after45, _ := json.Marshal(read(45))
	if string(before32Inventory) != string(after32Inventory) || string(before45) != string(after45) ||
		len(read(32)["resources"].([]any)) != 1 {
		t.Fatal("deletion must leave unrelated inventory/resources and excluded #45 intact")
	}
	var moved, removed, snapshots int
	pool.QueryRow(t.Context(), "SELECT count(*) FILTER(WHERE action='transfer'),count(*) FILTER(WHERE action='delete'),count(*) FILTER(WHERE inventory_before IS NOT NULL AND inventory_after IS NOT NULL) FROM dndshare.inventory_counter_migration").Scan(&moved, &removed, &snapshots)
	if moved != 4 || removed != 3 || snapshots != 6 {
		t.Fatalf("audit: transferred=%d removed=%d snapshots=%d", moved, removed, snapshots)
	}
	before40, _ := json.Marshal(read(40))
	exec(schemaResolvedInventoryCountersSQL)
	after40, _ := json.Marshal(read(40))
	if string(before40) != string(after40) {
		t.Fatal("repeat migration must not duplicate components")
	}
}
