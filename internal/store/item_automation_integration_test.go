package store

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestItemAutomationPersistence(t *testing.T) {
	dsn := os.Getenv("DNDSHARE_ITEM_AUTOMATION_TEST_DSN")
	if dsn == "" {
		t.Skip("set DNDSHARE_ITEM_AUTOMATION_TEST_DSN to a disposable local dndshare_test_* database")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Host != "127.0.0.1" || !strings.HasPrefix(cfg.ConnConfig.Database, "dndshare_test_") {
		t.Fatal("requires disposable local database")
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
 CREATE TABLE dndshare.item(id bigserial PRIMARY KEY, user_id bigint, name text, name_en text, data jsonb, type_id bigint, created_at timestamptz DEFAULT now(), parent_id bigint, custom_source_id bigint, icon_svg_id bigint, icon_image_id bigint, cover_image_id bigint);
 CREATE TABLE dndshare.custom_item_source(id bigserial PRIMARY KEY, user_id bigint, name text, is_default boolean);
 CREATE UNIQUE INDEX default_custom_source ON dndshare.custom_item_source(user_id) WHERE is_default;
 CREATE TABLE dndshare.svg_storage(id bigint PRIMARY KEY, data text);
 CREATE TABLE dndshare.storage_image(id bigint PRIMARY KEY, url text, deleted boolean);
 INSERT INTO dndshare.item(name,type_id,data) VALUES('Старая запись',2,'{"desc":"keep"}');`)
	defer exec(`DROP SCHEMA dndshare CASCADE`)
	exec(schemaItemAutomationSQL)
	exec(schemaItemAutomationSQL)
	s := &Store{pool: pool}
	read := func(id int64) Item {
		t.Helper()
		rows, err := pool.Query(ctx, "SELECT "+itemSelectColumns("i")+" FROM dndshare.item i "+itemMediaJoins("i")+" WHERE i.id=$1", id)
		if err != nil {
			t.Fatal(err)
		}
		items, err := collectItems(rows)
		if err != nil || len(items) != 1 {
			t.Fatalf("read: %v %v", items, err)
		}
		return items[0]
	}
	if old := read(1); old.AutomationStatus != "unreviewed" || string(old.Data) != `{"desc": "keep"}` {
		t.Fatalf("migration changed existing data: %+v", old)
	}
	status, note, interaction := "full", "Цель выбирает игрок", true
	patch := ItemAutomationPatch{&status, &note, &interaction}
	base, err := s.CreateBase(ctx, "Меч", "Sword", json.RawMessage(`{}`), 19, nil, patch)
	if err != nil {
		t.Fatal(err)
	}
	if got := read(base.ID); got.ItemAutomation != patch.Initial() || base.ItemAutomation != got.ItemAutomation {
		t.Fatal("base metadata missing")
	}
	own, err := s.Create(ctx, 42, "Своя способность", json.RawMessage(`{}`), 4, nil, patch)
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Update(ctx, own.ID, 43, false, "Чужая", nil, json.RawMessage(`{}`), ItemAutomationPatch{}); !errors.Is(err, ErrNotFound) {
		t.Fatalf("foreign update: %v", err)
	}
	if err := s.Update(ctx, own.ID, 42, false, "Новое название", nil, json.RawMessage(`{"desc":"new"}`), ItemAutomationPatch{}); err != nil {
		t.Fatal(err)
	}
	if got := read(own.ID); got.ItemAutomation != patch.Initial() {
		t.Fatal("omitted fields reset metadata")
	}
	partial, clear, off := "partial", "", false
	if err := s.Update(ctx, base.ID, 43, true, "Меч", nil, json.RawMessage(`{}`), ItemAutomationPatch{&partial, &clear, &off}); err != nil {
		t.Fatal(err)
	}
	if got := read(base.ID); got.AutomationStatus != partial || got.AutomationNote != "" || got.RequiresPlayerInteraction {
		t.Fatal("explicit clear failed")
	}
	if _, err := pool.Exec(ctx, `UPDATE dndshare.item SET automation_status='invalid' WHERE id=$1`, base.ID); err == nil {
		t.Fatal("database accepted unknown enum")
	}
}
