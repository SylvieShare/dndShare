package store

import (
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
	"os"
	"strings"
	"testing"
)

func TestItemRuleReferences(t *testing.T) {
	dsn := os.Getenv("DNDSHARE_RULE_REFERENCE_TEST_DSN")
	if dsn == "" {
		t.Skip("set DNDSHARE_RULE_REFERENCE_TEST_DSN to an empty local dndshare_test_* database")
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
 CREATE TABLE dndshare.item(id bigint PRIMARY KEY,user_id bigint,name text,type_id bigint,data jsonb);
 INSERT INTO dndshare.item VALUES
 (1,NULL,'Мастерство',4,'{"max_use":3,"use_resources":[{"key":"dice","title":"Кости"}],"feature_actions":[{"key":"strike","title":"Удар","menu_effects":[{"kind":"adjust_counter","counter_key":"level","value_id":"exhaustion","title":"Истощение"}]}]}'),
 (2,7,'Личное',4,'{"use_resources":[{"key":"own","title":"Свой ресурс"}]}'),
 (3,8,'Чужое',4,'{"use_resources":[{"key":"secret","title":"Скрытый ресурс"}]}'),
 (4,NULL,'Паладин',9,'{"class_resources":[{"key":"channel","title":"Божественный канал"}]}'),
 (5,NULL,'Ярость',15,'{"code":"rage"}'),
 (6,NULL,'Пустое',4,'{"use_resources":null,"feature_actions":{},"max_use":null}'),
 (7,NULL,'Компетентность',4,'{"choices":[{"key":"expertise","text":"Выберите навыки или инструменты"}]}');`)
	defer exec(`DROP SCHEMA dndshare CASCADE`)
	s := &Store{pool: pool}
	search := func(user *int64, kind, query string, itemID, excludeID int64, limit, offset int) []ItemRuleReference {
		t.Helper()
		refs, err := s.FindItemRuleReferences(ctx, user, itemID, excludeID, kind, query, limit, offset)
		if err != nil {
			t.Fatal(err)
		}
		return refs
	}
	if refs := search(nil, "resource", "", 0, 0, 40, 0); len(refs) != 2 {
		t.Fatalf("anonymous resources: %+v", refs)
	}
	user := int64(7)
	refs := search(&user, "resource", "", 0, 0, 40, 0)
	if len(refs) != 3 {
		t.Fatalf("owned/public resources: %+v", refs)
	}
	for _, ref := range refs {
		if ref.ItemID == 3 {
			t.Fatal("leaked another user's key")
		}
	}
	if refs := search(&user, "resource", "Мастерство", 1, 0, 40, 0); len(refs) != 2 {
		t.Fatalf("source search: %+v", refs)
	}
	if refs := search(&user, "resource", "", 0, 1, 40, 0); len(refs) != 1 {
		t.Fatalf("draft exclusion: %+v", refs)
	}
	if refs := search(nil, "resource_pool", "channel", 0, 0, 40, 0); len(refs) != 1 || refs[0].Block != "Ресурс класса" {
		t.Fatalf("typed pool: %+v", refs)
	}
	if refs := search(nil, "status", "Ярость", 0, 0, 40, 0); len(refs) != 1 || refs[0].Key != "rage" {
		t.Fatalf("status code: %+v", refs)
	}
	if refs := search(nil, "counter", "", 0, 0, 40, 0); len(refs) != 1 || refs[0].ValueID != "exhaustion" {
		t.Fatalf("counter target: %+v", refs)
	}
	if choices := search(nil, "choice", "инструменты", 0, 0, 40, 0); len(choices) != 1 || choices[0].Title != "Выберите навыки или инструменты" {
		t.Fatalf("choice should be found by its visible prompt: %+v", choices)
	}
	first, second := search(&user, "resource", "", 0, 0, 1, 0), search(&user, "resource", "", 0, 0, 1, 1)
	if len(first) != 1 || len(second) != 1 || first[0] == second[0] {
		t.Fatal("pagination must advance")
	}
	exec(`UPDATE dndshare.item SET data=jsonb_set(data,'{use_resources,0,key}','"renamed"') WHERE id=1`)
	if refs := search(nil, "resource", "dice", 0, 0, 40, 0); len(refs) != 0 {
		t.Fatal("stale key after update")
	}
	if refs := search(nil, "resource", "renamed", 0, 0, 40, 0); len(refs) != 1 {
		t.Fatal("missing updated key")
	}
	exec(`DELETE FROM dndshare.item WHERE id=1`)
	if refs := search(nil, "action", "strike", 0, 0, 40, 0); len(refs) != 0 {
		t.Fatal("stale key after delete")
	}
}
