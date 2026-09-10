package store

import (
	"context"
	"os"
	"strings"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Opt-in: point DNDSHARE_JOURNAL_TEST_DSN at an empty local disposable database.
func TestPersonalJournalMigrationAndSources(t *testing.T) {
	dsn := os.Getenv("DNDSHARE_JOURNAL_TEST_DSN")
	if dsn == "" {
		t.Skip("set DNDSHARE_JOURNAL_TEST_DSN to run PostgreSQL journal regression tests")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(cfg.ConnConfig.Database, "dndshare_test_") || (cfg.ConnConfig.Host != "127.0.0.1" && cfg.ConnConfig.Host != "localhost") {
		t.Fatal("journal integration tests require a local dndshare_test_* database")
	}
	cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
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
		CREATE TABLE dndshare.users (id bigint PRIMARY KEY, login text);
		CREATE TABLE dndshare."char" (id bigint PRIMARY KEY, uuid uuid DEFAULT gen_random_uuid(), user_id bigint, data json DEFAULT '{}', changed_at timestamptz DEFAULT now(), version bigint DEFAULT 1);
		CREATE TABLE dndshare."session" (id bigint PRIMARY KEY, uuid uuid DEFAULT gen_random_uuid(), owner_user_id bigint, name text, deleted boolean DEFAULT false);
		CREATE TABLE dndshare.session_participant (session_id bigint, char_id bigint, user_id bigint);
		CREATE TABLE dndshare.session_scene_item (id bigint PRIMARY KEY);
		INSERT INTO dndshare.users VALUES (1, 'Мастер'), (2, 'Игрок');
		INSERT INTO dndshare."char" (id, user_id) VALUES (1,1), (25,1), (2,2), (3,1), (4,2);
		UPDATE dndshare."char" SET uuid='cc503ec7-8250-4c00-a9a4-b830f39cdaf1' WHERE id=1;
		INSERT INTO dndshare."session" (id,owner_user_id,name,deleted) VALUES (1,1,'Кампания',false), (2,1,'Удалённая',true);
		INSERT INTO dndshare.session_participant VALUES (1,1,1), (2,25,1);`)
	exec(schemaJournalsSQL)
	exec(`INSERT INTO dndshare.journal (uuid,owner_user_id,name) VALUES
		('95cba40e-807d-463d-9f80-9e43b8c0a0b4',1,'Полный дневник'),
		('690207c5-4770-4e09-b9b2-1f2d08be59ef',1,'Копия персонажа'),
		(gen_random_uuid(),2,'Другой владелец');
		INSERT INTO dndshare.journal (session_id,name) VALUES (1,'Общий'),(2,'Удалённый');
		INSERT INTO dndshare.character_journal (char_id,journal_id) VALUES (1,2),(25,2),(2,3);
		INSERT INTO dndshare.journal_section (journal_id,position,title) VALUES (1,1,'Сессия 7'),(1,2,'Сессия 8'),(2,1,'Сессия 7'),(2,2,'Сессия 8');
		INSERT INTO dndshare.journal_entry (section_id,position,entry_type,title) SELECT 1,i,'event','Запись ' || i FROM generate_series(1,4) i;
		INSERT INTO dndshare.journal_entry (section_id,position,entry_type,title) SELECT 2,i,'event','Запись ' || i FROM generate_series(1,3) i;
		INSERT INTO dndshare.journal_entry (section_id,position,entry_type,title) SELECT 3,i,'event','Запись ' || i FROM generate_series(1,4) i;`)
	contentHash := func() string {
		t.Helper()
		var hash string
		if err := pool.QueryRow(ctx, `SELECT md5(jsonb_agg(to_jsonb(e) ORDER BY id)::text) FROM dndshare.journal_entry e`).Scan(&hash); err != nil {
			t.Fatal(err)
		}
		return hash
	}
	before := contentHash()
	exec(schemaPersonalCharacterJournalSQL)
	exec(schemaJournalEditingSQL)
	if contentHash() != before {
		t.Fatal("ownership migration must not change or delete any entries")
	}
	exec(schemaJournalEntryAuditSQL)
	beforeGraph := contentHash()
	exec(schemaJournalGraphSQL)
	if contentHash() != beforeGraph {
		t.Fatal("graph migration must preserve all entry content and audit")
	}
	s := &Store{pool: pool}
	original, err := s.GetCharacterJournal(ctx, 1)
	if err != nil || original == nil || original.ID != 1 || len(original.Sections) != 2 || len(original.Sections[1].Entries) != 3 {
		t.Fatalf("complete journal was not restored: %+v, %v", original, err)
	}
	if len(original.Graph.Nodes) != 7 || len(original.Graph.Links) != 5 {
		t.Fatalf("migration must connect each section in its original order: %+v", original.Graph)
	}
	copy, err := s.GetCharacterJournal(ctx, 25)
	if err != nil || copy == nil || copy.ID != 2 || len(copy.Sections[1].Entries) != 0 {
		t.Fatalf("copy's journal must remain intact: %+v, %v", copy, err)
	}
	sources, err := s.ListJournalSourcesForCharacter(ctx, 1, 1)
	if err != nil || len(sources) != 2 || sources[0].UUID != original.UUID || sources[1].Kind != "session" {
		t.Fatalf("expected own personal journal and current campaign: %+v, %v", sources, err)
	}
	copySources, err := s.ListJournalSourcesForCharacter(ctx, 25, 1)
	if err != nil || len(copySources) != 1 || copySources[0].UUID != copy.UUID {
		t.Fatalf("must exclude other characters and deleted sessions: %+v, %v", copySources, err)
	}
	if err := s.LinkCharacterJournal(ctx, 1, 4); err != nil {
		t.Fatal(err)
	}
	restored, err := s.CreatePersonalJournal(ctx, 1, 1, "Do not overwrite")
	if err != nil || restored.ID != original.ID || restored.Name != original.Name || len(restored.Sections) != 2 {
		t.Fatalf("creating again must select and return the existing content: %+v, %v", restored, err)
	}
	var wg sync.WaitGroup
	for range 8 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, err := s.CreatePersonalJournal(ctx, 3, 1, "Единственный"); err != nil {
				t.Errorf("concurrent create: %v", err)
			}
		}()
	}
	wg.Wait()
	var count int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM dndshare.journal WHERE personal_char_id=3`).Scan(&count); err != nil || count != 1 {
		t.Fatalf("concurrent creation must produce one personal journal, got %d: %v", count, err)
	}
	if _, err := s.CreatePersonalJournal(ctx, 3, 2, "Wrong owner"); err == nil {
		t.Fatal("another owner must not take an existing personal journal")
	}
	if allowed, err := s.UserCanAccessJournal(ctx, original.ID, 2); err != nil || allowed {
		t.Fatalf("personal journal access leaked: allowed=%v, err=%v", allowed, err)
	}
	t.Run("editing permissions and ordering", func(t *testing.T) {
		testJournalEditing(t, s)
	})
	t.Run("entry audit", func(t *testing.T) {
		testJournalEntryAudit(t, s)
	})
	t.Run("graph branches, merges and conflicts", func(t *testing.T) { testJournalGraph(t, s) })
	t.Run("timeline order preserves content and graph", func(t *testing.T) { testJournalTimelineOrder(t, s) })
}
