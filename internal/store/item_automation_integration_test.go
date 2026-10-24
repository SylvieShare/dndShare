package store

import (
	"context"
	"dndshare/internal/testdb"
	"encoding/json"
	"errors"
	"testing"
)

func TestItemAutomationPersistence(t *testing.T) {
	pool := testdb.Pool(t)
	ctx := context.Background()
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
	exec(testSchemaColumns(t, "item", "automation_status", "automation_note", "requires_player_interaction"))
	exec(testSchemaChecks(t, "item", "item_automation_status_check", "item_automation_note_check"))
	exec(`INSERT INTO dndshare.item(name,name_en,type_id,data) VALUES ('Магус','Magus',9,'{}'),('Шаман','Shaman',9,'{}');
 ALTER TABLE dndshare.item ADD COLUMN derived_from_item_id bigint, ADD COLUMN derivation_kind text;
 CREATE TABLE dndshare.source_version(id bigint,version text);
 CREATE TABLE dndshare.item_version_compatibility(item_id bigint,source_version_id bigint,status text,replaced_by_item_id bigint,adapter_code text,note text);
 CREATE TABLE dndshare.content_source(id bigint PRIMARY KEY, name text, code text);
 CREATE TABLE dndshare.item_content_source(item_id bigint,content_source_id bigint,primary_source boolean);`)
	exec(`CREATE TABLE dndshare.item_model(item_id bigint,model_id uuid,is_default boolean,sort_order integer);`)
	exec(testSchemaColumns(t, "item", "hidden"))
	exec(`UPDATE dndshare.item SET hidden=true WHERE name_en IN ('Magus','Shaman')`)
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
	patch := ItemMetadataPatch{AutomationStatus: &status, AutomationNote: &note, RequiresPlayerInteraction: &interaction}
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
	if err := s.Update(ctx, own.ID, 43, false, "Чужая", nil, json.RawMessage(`{}`), ItemMetadataPatch{}); !errors.Is(err, ErrNotFound) {
		t.Fatalf("foreign update: %v", err)
	}
	if err := s.Update(ctx, own.ID, 42, false, "Новое название", nil, json.RawMessage(`{"desc":"new"}`), ItemMetadataPatch{}); err != nil {
		t.Fatal(err)
	}
	if got := read(own.ID); got.ItemAutomation != patch.Initial() {
		t.Fatal("omitted fields reset metadata")
	}
	partial, clear, off := "partial", "", false
	if err := s.Update(ctx, base.ID, 43, true, "Меч", nil, json.RawMessage(`{}`), ItemMetadataPatch{AutomationStatus: &partial, AutomationNote: &clear, RequiresPlayerInteraction: &off}); err != nil {
		t.Fatal(err)
	}
	if got := read(base.ID); got.AutomationStatus != partial || got.AutomationNote != "" || got.RequiresPlayerInteraction {
		t.Fatal("explicit clear failed")
	}
	testHiddenItemVisibility(t, s)
	if _, err := pool.Exec(ctx, `UPDATE dndshare.item SET automation_status='invalid' WHERE id=$1`, base.ID); err == nil {
		t.Fatal("database accepted unknown enum")
	}
}
