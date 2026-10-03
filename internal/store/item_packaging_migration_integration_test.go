package store

import (
	"encoding/json"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestItemPackagingAndCounterMigrationPostgres(t *testing.T) {
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
CREATE TABLE dndshare.item_type(id bigint PRIMARY KEY,fields jsonb);
INSERT INTO dndshare.item_type VALUES(2,'[]');
CREATE TABLE dndshare.item(id bigint PRIMARY KEY,data jsonb);
INSERT INTO dndshare.item VALUES(347,'{"cost":{"value":1,"suggest_id":3},"weight":1}');
CREATE TABLE dndshare."char"(id bigint PRIMARY KEY,uuid uuid,deleted boolean DEFAULT false,
 data jsonb NOT NULL,version bigint DEFAULT 10,changed_at timestamptz);
INSERT INTO dndshare."char"(id,uuid,data,deleted) VALUES
(1,'cc503ec7-8250-4c00-a9a4-b830f39cdaf1',
 '{"values":{"resources":[{"title":"resource","value":4}],"counters":[{"id":"cnt277mg","name":"Стрелы","value":13,"max":null},{"id":"cnt3jjx8","name":"Рацион","value":8}],"items":{"equipped":[{"uid":"worn","item_id":12}],"sections":[{"id":"bag","name":"Мой рюкзак","items":[{"uid":"kept","item_id":408,"count":2,"params":{"custom":7}}],"slots":{"worn":0,"kept":2}},{"id":"other","items":[{"uid":"other-item","item_id":408}],"slots":{"other-item":0}}]}}}',false),
(25,'8c53c0f7-b697-49b1-9544-c0ff9e2cf86c',
 '{"values":{"counters":[{"id":"cnt277mg","name":"Стрелы","value":13},{"id":"cnt3jjx8","name":"Рацион","value":8}]}}',true),
(29,'8a705fca-08ae-4ef9-b8fd-73faa9245413',
 '{"values":{"counters":[{"id":"cnt2rc6","name":"факел","value":11},{"id":"cnt3320g","name":"Сухпайки","value":10},{"id":"cnt435o8","name":"2352","value":0}]}}',false),
(40,'07ae13a7-83ca-44a9-a9f6-ef7dbe1b3695',
 '{"values":{"counters":[{"id":"cnt3hdvm","name":"Одежда культистов","value":1},{"id":"cnt46hh6","name":"Медальон","value":1},{"id":"cnt2i085","name":"Сухой паёк","value":3}],"items":{"sections":[{"id":"stage","items":[{"uid":"pack","item_id":447},{"uid":"gift","item_id":4565}]}]}}}',false),
(45,'3e01e5e5-e7ad-414f-a644-8f9299f6763f',
 '{"values":{"counters":[{"id":"cnt277mg","name":"Стрелы","value":13}]}}',true),
(5,'d42188e0-cc1b-4375-8af7-5d638bbd179d',
 '{"values":{"counters":[{"id":"cnt1owp","name":"Факел","value":10},{"id":"cnt28i73","name":"Рацион","value":8}],"items":{"sections":[{"id":"bag","items":[{"uid":"existing-torch","item_id":439,"count":2}]}]}}}',false);`)
	exec(schemaItemPurchaseQuantitySQL)
	for _, data := range []string{`{"purchase_quantity":0}`, `{"purchase_quantity":1.5}`, `{"purchase_quantity":"20"}`} {
		if _, err := pool.Exec(t.Context(), "UPDATE dndshare.item SET data=$1::jsonb WHERE id=347", data); err == nil {
			t.Fatalf("invalid packaging accepted: %s", data)
		}
	}
	exec(`UPDATE dndshare.item SET data=data || '{"purchase_quantity":20}';`)
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
		return doc
	}
	before45, _ := json.Marshal(read(45))
	exec(schemaInventoryCounterMigrationSQL)
	values := read(1)["values"].(map[string]any)
	if len(values["counters"].([]any)) != 0 || len(values["resources"].([]any)) != 1 {
		t.Fatal("physical tiles must move while manual resources stay")
	}
	inventory := values["items"].(map[string]any)
	sections := inventory["sections"].([]any)
	first := sections[0].(map[string]any)
	if len(first["items"].([]any)) != 3 || len(sections) != 2 || len(inventory["equipped"].([]any)) != 1 {
		t.Fatalf("inventory content changed unexpectedly: %+v", inventory)
	}
	slots := first["slots"].(map[string]any)
	if slots["worn"] != float64(0) || slots["kept"] != float64(2) || slots["counter-1-cnt277mg"] != float64(1) || slots["counter-1-cnt3jjx8"] != float64(3) {
		t.Fatalf("existing positions must stay; new entries fill holes: %+v", slots)
	}
	deletedValues := read(25)["values"].(map[string]any)
	entries := deletedValues["items"].(map[string]any)["sections"].([]any)[0].(map[string]any)["items"].([]any)
	if entries[0].(map[string]any)["uid"] != "counter-25-cnt277mg" || entries[0].(map[string]any)["count"] != float64(13) {
		t.Fatalf("clone must have independent quantity and UID: %+v", entries)
	}
	var deleted bool
	if err := pool.QueryRow(t.Context(), `SELECT deleted FROM dndshare."char" WHERE id=25`).Scan(&deleted); err != nil || !deleted {
		t.Fatal("migration must preserve deleted state")
	}
	if len(read(29)["values"].(map[string]any)["counters"].([]any)) != 2 {
		t.Fatal("ambiguous and zero tiles must remain")
	}
	stage := read(40)["values"].(map[string]any)
	if len(stage["counters"].([]any)) != 1 {
		t.Fatal("pack ration tile must remain")
	}
	stageItems := stage["items"].(map[string]any)["sections"].([]any)[0].(map[string]any)["items"].([]any)
	medallion := stageItems[3].(map[string]any)
	if medallion["item_id"] != nil || medallion["override"].(map[string]any)["name"] != "Медальон" {
		t.Fatalf("story item must keep its exact name and no invented mechanics: %+v", medallion)
	}
	after45, _ := json.Marshal(read(45))
	if string(before45) != string(after45) {
		t.Fatal("excluded copy #45 must stay unchanged")
	}
	if len(read(5)["values"].(map[string]any)["counters"].([]any)) != 1 {
		t.Fatal("preexisting matching stack requires review, not addition")
	}
	var receipts int
	if err := pool.QueryRow(t.Context(), "SELECT count(*) FROM dndshare.inventory_counter_migration").Scan(&receipts); err != nil || receipts != 8 {
		t.Fatalf("audit receipts: %d %v", receipts, err)
	}
	var beforeVersion, afterVersion int
	pool.QueryRow(t.Context(), `SELECT version FROM dndshare."char" WHERE id=1`).Scan(&beforeVersion)
	exec(schemaInventoryCounterMigrationSQL)
	pool.QueryRow(t.Context(), `SELECT version FROM dndshare."char" WHERE id=1`).Scan(&afterVersion)
	if beforeVersion != afterVersion || len(read(1)["values"].(map[string]any)["items"].(map[string]any)["sections"].([]any)[0].(map[string]any)["items"].([]any)) != 3 {
		t.Fatal("repeat migration must not add duplicates or bump version")
	}
}
