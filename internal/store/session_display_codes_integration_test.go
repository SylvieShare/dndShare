package store

import (
	"context"
	"errors"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestSessionDisplayCodesMigrationAndLookup(t *testing.T) {
	dsn := os.Getenv("DNDSHARE_DISPLAY_TEST_DSN")
	if dsn == "" {
		t.Skip("set DNDSHARE_DISPLAY_TEST_DSN to a disposable local dndshare_test_* database")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(cfg.ConnConfig.Database, "dndshare_test_") || cfg.ConnConfig.Host != "127.0.0.1" {
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
	CREATE TABLE dndshare.source (id bigint, name text);
	CREATE TABLE dndshare.session (
	  id bigserial PRIMARY KEY, uuid uuid NOT NULL DEFAULT gen_random_uuid(), owner_user_id bigint,
	  name text, description text, system_id bigint, invite_code text, current_chapter_id bigint,
	  created_at timestamptz DEFAULT now(), changed_at timestamptz DEFAULT now(), deleted bool DEFAULT false
	);
	CREATE TABLE dndshare.session_arc (session_id bigint, "order" int, name text);
	CREATE TABLE dndshare.session_presentation_state (session_id bigint);
	INSERT INTO dndshare.session (name) SELECT 'Existing ' || i FROM generate_series(1, 500) i;`)
	defer exec(`DROP SCHEMA dndshare CASCADE`)
	exec(schemaSessionDisplayCodesSQL)
	var valid bool
	err = pool.QueryRow(ctx, `SELECT count(*) = count(DISTINCT display_code)
	  AND bool_and(display_code ~ '^[A-Z0-9]{3}-[A-Z0-9]{3}$') FROM dndshare.session`).Scan(&valid)
	if err != nil || !valid {
		t.Fatalf("backfill: valid=%v err=%v", valid, err)
	}
	s := &Store{pool: pool}
	id, _, err := s.CreateSessionWithFirstArc(ctx, 1, "New session", nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	session, err := s.GetGameSession(ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	found, err := s.GetGameSessionByDisplayCode(ctx, strings.ToLower(session.DisplayCode))
	if err != nil || found.ID != id {
		t.Fatalf("case-insensitive lookup: %#v %v", found, err)
	}

	// Force a collision on the next insert and prove that allocation retries safely.
	exec(`UPDATE dndshare.session SET display_code = 'ABC-123' WHERE id = 1;
	CREATE SEQUENCE dndshare.test_display_attempt;
	CREATE OR REPLACE FUNCTION dndshare.generate_display_code() RETURNS text LANGUAGE sql VOLATILE
	AS $$ SELECT CASE WHEN nextval('dndshare.test_display_attempt') = 1 THEN 'ABC-123' ELSE 'XYZ-789' END $$;`)
	newID, _, err := s.CreateSessionWithFirstArc(ctx, 1, "After collision", nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	found, err = s.GetGameSessionByDisplayCode(ctx, "xYz-789")
	if err != nil || found.ID != newID {
		t.Fatalf("collision retry: %#v %v", found, err)
	}
	exec(`UPDATE dndshare.session SET deleted = true WHERE display_code = 'XYZ-789'`)
	if _, err := s.GetGameSessionByDisplayCode(ctx, "XYZ-789"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("deleted session lookup: %v", err)
	}
}
