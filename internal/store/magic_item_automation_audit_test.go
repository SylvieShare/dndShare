package store

import (
	"context"
	"encoding/json"
	"os"
	"regexp"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
)

type reviewedMagicItem struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	DataHash    string `json:"data_hash"`
	Status      string `json:"status"`
	Note        string `json:"note"`
	Interaction bool   `json:"interaction"`
}

func magicAutomationReview(t *testing.T) []reviewedMagicItem {
	t.Helper()
	parts := strings.Split(schemaMagicItemAutomationAuditSQL, "$audit$")
	if len(parts) != 3 {
		t.Fatal("missing audit manifest")
	}
	var rows []reviewedMagicItem
	if err := json.Unmarshal([]byte(parts[1]), &rows); err != nil {
		t.Fatal(err)
	}
	return rows
}

func TestMagicItemAutomationAuditManifest(t *testing.T) {
	rows := magicAutomationReview(t)
	if len(rows) != 244 {
		t.Fatalf("reviewed %d, want 244", len(rows))
	}
	seen := map[int64]bool{}
	counts := map[string]int{}
	interaction := 0
	hash := regexp.MustCompile(`^[a-f0-9]{32}$`)
	for _, row := range rows {
		if row.ID <= 0 || seen[row.ID] {
			t.Fatalf("duplicate/invalid ID %d", row.ID)
		}
		seen[row.ID] = true
		if row.Name == "" || strings.TrimSpace(row.Note) == "" || !hash.MatchString(row.DataHash) {
			t.Fatalf("missing evidence for %d", row.ID)
		}
		patch := ItemAutomationPatch{AutomationStatus: &row.Status, AutomationNote: &row.Note}
		if err := patch.Validate(); err != nil {
			t.Fatalf("item %d: %v", row.ID, err)
		}
		counts[row.Status]++
		if row.Interaction {
			interaction++
		}
	}
	if counts["full"] != 34 || counts["partial"] != 26 || counts["none"] != 184 || interaction != 8 {
		t.Fatalf("coverage counts=%v, interaction=%d", counts, interaction)
	}
	// A mundane base alone is not evidence that the item's magic works.
	for _, row := range rows {
		switch row.ID {
		case 78, 117, 155, 169, 170, 212, 232:
			if row.Status != "none" {
				t.Fatalf("ordinary base inflated coverage for %d", row.ID)
			}
		case 134, 171, 189, 202, 233, 284:
			if row.Status != "full" {
				t.Fatalf("configured reusable weapon mechanic lost coverage for %d", row.ID)
			}
		}
	}
}

func TestMagicItemAutomationAuditMigration(t *testing.T) {
	dsn := os.Getenv("DNDSHARE_ITEM_AUTOMATION_TEST_DSN")
	if dsn == "" {
		t.Skip("set DNDSHARE_ITEM_AUTOMATION_TEST_DSN to a disposable local database")
	}
	cfg, err := pgx.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Host != "127.0.0.1" || !strings.HasPrefix(cfg.Database, "dndshare_test_") {
		t.Fatal("requires disposable local database")
	}
	cfg.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	cfg.RuntimeParams["client_encoding"] = "UTF8"
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
	exec := func(sql string, args ...any) int64 {
		t.Helper()
		tag, err := tx.Exec(ctx, sql, args...)
		if err != nil {
			t.Fatal(err)
		}
		return tag.RowsAffected()
	}
	exec(`CREATE SCHEMA dndshare;
 CREATE TABLE dndshare.item(id bigint PRIMARY KEY, name text, type_id bigint, user_id bigint, data jsonb);`)
	exec(schemaItemAutomationSQL)
	raw, err := os.ReadFile("testdata/magic_item_automation_audit.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture []struct {
		ID   int64
		Name string
		Data json.RawMessage
	}
	if err := json.Unmarshal(raw, &fixture); err != nil {
		t.Fatal(err)
	}
	for _, item := range fixture {
		exec(`INSERT INTO dndshare.item(id,name,type_id,data) VALUES($1,$2,19,$3::jsonb)`, item.ID, item.Name, string(item.Data))
	}
	exec(`INSERT INTO dndshare.item(id,name,type_id,data) VALUES(99999,'Новый предмет',19,'{"note":"keep"}')`)
	fingerprint := func() string {
		t.Helper()
		var value string
		err := tx.QueryRow(ctx, `SELECT md5(jsonb_agg(to_jsonb(i)-'automation_status'-'automation_note'-'requires_player_interaction' ORDER BY id)::text) FROM dndshare.item i`).Scan(&value)
		if err != nil {
			t.Fatal(err)
		}
		return value
	}
	before := fingerprint()
	if got := exec(schemaMagicItemAutomationAuditSQL); got != int64(len(fixture)) {
		t.Fatalf("updated %d, want %d", got, len(fixture))
	}
	reviewed := map[int64]reviewedMagicItem{}
	for _, row := range magicAutomationReview(t) {
		reviewed[row.ID] = row
	}
	for _, item := range fixture {
		row := reviewed[item.ID]
		var status, note string
		var interaction bool
		if err := tx.QueryRow(ctx, `SELECT automation_status,automation_note,requires_player_interaction FROM dndshare.item WHERE id=$1`, item.ID).Scan(&status, &note, &interaction); err != nil {
			t.Fatal(err)
		}
		if status != row.Status || note != row.Note || interaction != row.Interaction {
			t.Fatalf("incorrect saved assessment for %d", item.ID)
		}
	}
	if got := exec(schemaMagicItemAutomationAuditSQL); got != 0 {
		t.Fatalf("repeat updated %d rows", got)
	}
	if fingerprint() != before {
		t.Fatal("audit changed gameplay data or identity")
	}
	exec(`UPDATE dndshare.item SET automation_status='unreviewed',automation_note='',requires_player_interaction=false;
 UPDATE dndshare.item SET data=data||'{"author_rule":true}' WHERE id=93;
 UPDATE dndshare.item SET name='Авторское название' WHERE id=103;
 UPDATE dndshare.item SET user_id=42 WHERE id=136;
 UPDATE dndshare.item SET type_id=2 WHERE id=170;
 UPDATE dndshare.item SET automation_status='partial',automation_note='Авторская оценка' WHERE id=189;
 UPDATE dndshare.item SET automation_note='Незаконченный разбор' WHERE id=252;
 UPDATE dndshare.item SET requires_player_interaction=true WHERE id=334;`)
	before = fingerprint()
	if got := exec(schemaMagicItemAutomationAuditSQL); got != 2 {
		t.Fatalf("snapshot guards updated %d rows, want 2", got)
	}
	var protected bool
	err = tx.QueryRow(ctx, `SELECT
  (SELECT bool_and(automation_status='unreviewed') FROM dndshare.item WHERE id IN(93,103,136,170,252,334,99999))
  AND (SELECT automation_note='Авторская оценка' AND automation_status='partial' FROM dndshare.item WHERE id=189)
  AND (SELECT automation_note='Незаконченный разбор' FROM dndshare.item WHERE id=252)
  AND (SELECT requires_player_interaction FROM dndshare.item WHERE id=334)`).Scan(&protected)
	if err != nil || !protected {
		t.Fatalf("overwrote authored assessments: %v", err)
	}
	if fingerprint() != before {
		t.Fatal("guarded audit changed gameplay data")
	}
}
