package store

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestRulesEditionsMigration(t *testing.T) {
	dsn := os.Getenv("DNDSHARE_EDITIONS_TEST_DSN")
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
	exec(`DROP SCHEMA IF EXISTS dndshare CASCADE`)
	defer exec(`DROP SCHEMA dndshare CASCADE`)
	for _, sql := range []string{schemaFoundationSQL, schemaHandbookSQL, schemaCharactersSQL, schemaSessionsSQL, schemaItemAutomationSQL, schemaHiddenItemsSQL} {
		exec(sql)
	}
	exec(`INSERT INTO dndshare.users(id,login,password) VALUES(101,'edition-test','test'),(102,'other-test','test');
 INSERT INTO dndshare.item_type(id,name,source_id) SELECT 999,'Edition test',id FROM dndshare.source WHERE name='DND5e';
 INSERT INTO dndshare.custom_item_source(id,user_id,name,is_default) VALUES(9101,101,'Own',false),(9102,102,'Other',false);
 INSERT INTO dndshare.item(id,name,type_id,data,user_id,custom_source_id) VALUES(9001,'Shared',999,'{}',NULL,NULL),(9002,'Changed',999,'{}',NULL,NULL),(9003,'Personal',999,'{}',101,9101),(9004,'Foreign',999,'{}',102,9102);`)
	for _, sql := range []string{schemaRulesEditionsSQL, schemaCharacterEditionValidationSQL, schemaSessionRulesEditionSQL, schemaOriginRulesFieldsSQL} {
		exec(sql)
	}
	s := &Store{pool: pool}
	var v14, v24 int64
	if err = pool.QueryRow(ctx, `SELECT id FROM dndshare.source_version WHERE version='2014'`).Scan(&v14); err != nil {
		t.Fatal(err)
	}
	if err = pool.QueryRow(ctx, `SELECT id FROM dndshare.source_version WHERE version='2024'`).Scan(&v24); err != nil {
		t.Fatal(err)
	}
	selectIDs := func(version int64, legacy bool, books []int64, restrict bool) []int64 {
		t.Helper()
		args := []any{int64(101)}
		where := appendContentScopeSQL([]string{"(i.user_id IS NULL OR i.user_id=$1)", "NOT i.hidden"}, &args, ContentScope{SourceVersionID: &version, AllowLegacy: legacy, IDs: books, RestrictToIDs: restrict})
		rows, err := pool.Query(ctx, `SELECT i.id FROM dndshare.item i WHERE `+strings.Join(where, " AND ")+` ORDER BY i.id`, args...)
		if err != nil {
			t.Fatal(err)
		}
		defer rows.Close()
		ids := []int64{}
		for rows.Next() {
			var id int64
			if err = rows.Scan(&id); err != nil {
				t.Fatal(err)
			}
			ids = append(ids, id)
		}
		if err = rows.Err(); err != nil {
			t.Fatal(err)
		}
		return ids
	}
	if got := fmt.Sprint(selectIDs(v14, false, nil, false)); got != "[9001 9002 9003]" {
		t.Fatal(got)
	}
	if got := selectIDs(v24, false, nil, false); len(got) != 0 {
		t.Fatal("unreviewed items leaked", got)
	}
	set := func(id int64, rows ...ItemCompatibility) {
		t.Helper()
		if err := s.SetItemCompatibility(ctx, id, 101, true, rows); err != nil {
			t.Fatal(err)
		}
	}
	set(9001, ItemCompatibility{SourceVersionID: v14, Status: "native"}, ItemCompatibility{SourceVersionID: v24, Status: "compatible"})
	set(9003, ItemCompatibility{SourceVersionID: v14, Status: "native"}, ItemCompatibility{SourceVersionID: v24, Status: "requires_adaptation"})
	replacement := int64(9001)
	set(9002, ItemCompatibility{SourceVersionID: v14, Status: "native"}, ItemCompatibility{SourceVersionID: v24, Status: "legacy", ReplacedByItemID: &replacement})
	if got := fmt.Sprint(selectIDs(v24, false, nil, false)); got != "[9001]" {
		t.Fatal(got)
	}
	if got := fmt.Sprint(selectIDs(v24, true, nil, false)); got != "[9001 9002 9003]" {
		t.Fatal(got)
	}
	hidden := true
	if err = s.Update(ctx, 9001, 101, true, "Shared", nil, json.RawMessage(`{}`), ItemMetadataPatch{Hidden: &hidden}); err == nil {
		t.Fatal("used replacement can be hidden")
	}
	if err = s.SetItemCompatibility(ctx, 9004, 101, false, []ItemCompatibility{}); err != ErrNotFound {
		t.Fatal("foreign mutation accepted", err)
	}
	var book int64
	if err = pool.QueryRow(ctx, `SELECT id FROM dndshare.content_source WHERE native_source_version_id=$1 LIMIT 1`, v24).Scan(&book); err != nil {
		t.Fatal(err)
	}
	exec(`INSERT INTO dndshare.item_content_source(item_id,content_source_id) VALUES(9001,$1)`, book)
	if got := selectIDs(v24, false, nil, true); len(got) != 0 {
		t.Fatal("book restriction leaked", got)
	}
	if got := fmt.Sprint(selectIDs(v24, false, []int64{book}, true)); got != "[9001]" {
		t.Fatal(got)
	}
	// References already on the sheet survive later decisions; new ones must qualify.
	var template int64
	if err = pool.QueryRow(ctx, `SELECT id FROM dndshare.char_template LIMIT 1`).Scan(&template); err != nil {
		t.Fatal(err)
	}
	var charID int64
	if err = pool.QueryRow(ctx, `INSERT INTO dndshare."char"(user_id,template_id,source_version_id,data) VALUES(101,$1,$2,$3::jsonb) RETURNING id`, template, v24, `{"values":{"abilities_feats":[{"id":9001}]}}`).Scan(&charID); err != nil {
		t.Fatal(err)
	}
	exec(`UPDATE dndshare.item_version_compatibility SET status='blocked' WHERE item_id=9001 AND source_version_id=$1`, v24)
	exec(`UPDATE dndshare."char" SET data=jsonb_set(data,'{values,name}','"Keep"') WHERE id=$1`, charID)
	exec(`INSERT INTO dndshare."char"(user_id,template_id,source_version_id,data,cloned_from_char_id) SELECT user_id,template_id,source_version_id,data,id FROM dndshare."char" WHERE id=$1`, charID)
	if _, err = pool.Exec(ctx, `INSERT INTO dndshare."char"(user_id,template_id,source_version_id,data,cloned_from_char_id) SELECT 102,template_id,source_version_id,data,id FROM dndshare."char" WHERE id=$1`, charID); err == nil {
		t.Fatal("foreign clone bypassed edition validation")
	}
	exec(`UPDATE dndshare.item SET data='{"choices":[{"key":"spells","source":"item"},{"key":"languages","source":"suggest"}]}' WHERE id=9001`)
	if _, err = pool.Exec(ctx, `UPDATE dndshare."char" SET data='{"values":{"abilities_feats":[{"id":9001,"choices":{"spells":[9002]}}]}}' WHERE id=$1`, charID); err == nil {
		t.Fatal("new nested spell choice bypassed edition validation")
	}
	exec(`UPDATE dndshare."char" SET data='{"values":{"abilities_feats":[{"id":9001,"choices":{"languages":[9002]}}]}}' WHERE id=$1`, charID)
	for _, id := range []int64{9002, 9003, 9004} {
		raw, _ := json.Marshal(map[string]any{"values": map[string]any{"abilities_feats": []map[string]int64{{"id": 9001}, {"id": id}}}})
		if _, err = pool.Exec(ctx, `UPDATE dndshare."char" SET data=$2::jsonb WHERE id=$1`, charID, string(raw)); err == nil {
			t.Fatalf("invalid new reference %d accepted", id)
		}
	}
	if _, err = pool.Exec(ctx, `UPDATE dndshare."char" SET source_version_id=$2 WHERE id=$1`, charID, v14); err == nil {
		t.Fatal("silent conversion accepted")
	}
	exec(`INSERT INTO dndshare.item(id,name,type_id,data) VALUES(9005,'To review',999,'{}')`)
	exec(`INSERT INTO dndshare.item_content_source(item_id,content_source_id) VALUES(9005,$1)`, book)
	preview, err := s.ReviewPublicationCompatibility(ctx, book, v24, "compatible", "", false)
	if err != nil {
		t.Fatal(err)
	}
	if len(preview.Items) != 1 || preview.Items[0].ID != 9005 || preview.Skipped != 1 {
		t.Fatalf("preview %+v", preview)
	}
	if _, err = s.ReviewPublicationCompatibility(ctx, book, v24, "compatible", "stale", true); err == nil {
		t.Fatal("stale bulk preview accepted")
	}
	applied, err := s.ReviewPublicationCompatibility(ctx, book, v24, "compatible", preview.Token, true)
	if err != nil || !applied.Applied {
		t.Fatal(applied, err)
	}
	variant, err := s.CreateItemVariant(ctx, 9001, 101, v24, "adaptation")
	if err != nil {
		t.Fatal(err)
	}
	if variant.DerivedFromItemID == nil || *variant.DerivedFromItemID != 9001 || len(variant.Compatibility) != 1 || variant.Compatibility[0].Status != "requires_adaptation" {
		t.Fatalf("variant %+v", variant)
	}
	if variant.ID == 9001 || variant.UserID == nil || *variant.UserID != 101 {
		t.Fatal("variant overwritten original or incorrect owner")
	}

	testEditionImport(t, s, pool, v24, book)
}

func testEditionImport(t *testing.T, s *Store, pool *pgxpool.Pool, version, book int64) {
	t.Helper()
	ctx := context.Background()
	original := int64(9005)
	req := EditionImportRequest{ContentSourceID: book, SourceVersionID: version, Records: []EditionImportRecord{
		{Key: "edition-test:base", Name: "New edition", TypeID: 999, OriginalID: &original, Data: map[string]any{"description": "reviewed"}, AutomationStatus: "none"},
		{Key: "edition-test:linked", Name: "Linked", TypeID: 999, Data: map[string]any{"other": map[string]any{"$ref": "edition-test:base"}}, AutomationStatus: "none"},
	}}
	preview, err := s.ImportEdition(ctx, req)
	if err != nil || preview.Created != 2 || preview.Applied {
		t.Fatalf("preview: %+v %v", preview, err)
	}
	req.Apply = true
	req.PreviewToken = "stale"
	if _, err = s.ImportEdition(ctx, req); err == nil {
		t.Fatal("stale import accepted")
	}
	req.PreviewToken = preview.Token
	applied, err := s.ImportEdition(ctx, req)
	if err != nil || !applied.Applied {
		t.Fatalf("apply: %+v %v", applied, err)
	}
	var linked int64
	if err = pool.QueryRow(ctx, `SELECT (data->>'other')::bigint FROM dndshare.item WHERE id=$1`, applied.IDs["edition-test:linked"]).Scan(&linked); err != nil || linked != applied.IDs["edition-test:base"] {
		t.Fatal("reference not resolved", linked, err)
	}
	if _, err = pool.Exec(ctx, `UPDATE dndshare.item SET data=jsonb_set(data,'{description}','"edited later"') WHERE id=$1`, linked); err != nil {
		t.Fatal(err)
	}
	req.Apply = false
	req.PreviewToken = ""
	again, err := s.ImportEdition(ctx, req)
	if err != nil || again.Existing != 2 || again.Created != 0 {
		t.Fatal("not idempotent", again, err)
	}
	req.Apply = true
	req.PreviewToken = again.Token
	if _, err = s.ImportEdition(ctx, req); err != nil {
		t.Fatal(err)
	}
	var description string
	if err = pool.QueryRow(ctx, `SELECT data->>'description' FROM dndshare.item WHERE id=$1`, linked).Scan(&description); err != nil || description != "edited later" {
		t.Fatal("editorial update lost", description, err)
	}
	req.Records[0].Name = "Changed import"
	if _, err = s.ImportEdition(ctx, req); err == nil {
		t.Fatal("changed import fingerprint accepted")
	}
	req.Records = []EditionImportRecord{{Key: "bad-ref", Name: "Missing", TypeID: 999, Data: map[string]any{"other": map[string]any{"$ref": "missing"}}, AutomationStatus: "none"}}
	req.Apply = false
	if _, err = s.ImportEdition(ctx, req); err == nil {
		t.Fatal("unknown import reference accepted")
	}
}
