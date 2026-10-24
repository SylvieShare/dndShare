package store

import (
	"context"
	"dndshare/internal/testdb"
	"errors"
	"strings"
	"testing"
)

func TestSessionDisplayCodesAndLookup(t *testing.T) {
	pool := testdb.Pool(t)
	ctx := context.Background()
	var err error
	exec := func(sql string) {
		t.Helper()
		if _, err := pool.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	exec(`CREATE SCHEMA dndshare;
	CREATE TABLE dndshare.source (id bigint, name text);
	CREATE TABLE dndshare.source_version (id bigint, version text);
	CREATE TABLE dndshare.session (
	  id bigserial PRIMARY KEY, uuid uuid NOT NULL DEFAULT gen_random_uuid(), owner_user_id bigint,
	  name text, description text, system_id bigint, source_version_id bigint, invite_code text, current_chapter_id bigint,
	  created_at timestamptz DEFAULT now(), changed_at timestamptz DEFAULT now(), deleted bool DEFAULT false
	);
	CREATE TABLE dndshare.session_arc (session_id bigint, "order" int, name text);
	CREATE TABLE dndshare.session_presentation_state (session_id bigint);`)
	defer exec(`DROP SCHEMA dndshare CASCADE`)
	exec(testSchemaFunctions(t))
	exec(testSchemaColumns(t, "session", "display_code", "status", "settings"))
	exec(testSchemaChecks(t, "session", "session_display_code_format", "session_status_check", "session_settings_object"))
	exec(`CREATE UNIQUE INDEX fixture_session_code ON dndshare.session(display_code);
 INSERT INTO dndshare.session(name) SELECT 'Existing ' || i FROM generate_series(1,500) i;
 UPDATE dndshare.session SET settings=jsonb_set(jsonb_set(settings,'{players,seeClass}','false'),'{players,seeHp}','true') WHERE id=1;`)
	exec(testSchemaTables(t, "session_karmic_scale", "session_d20_roll"))
	exec(`INSERT INTO dndshare.session_karmic_scale VALUES(1,'shared','Общая шкала',3)`)
	var preservedBalance float64
	if err := pool.QueryRow(ctx, `SELECT balance FROM dndshare.session_karmic_scale WHERE session_id=1`).Scan(&preservedBalance); err != nil || preservedBalance != 3 {
		t.Fatalf("fractional migration lost balance: %v %v", preservedBalance, err)
	}
	var migrated SessionSettings
	if err := pool.QueryRow(ctx, `SELECT settings FROM dndshare.session WHERE id = 1`).Scan(&migrated); err != nil {
		t.Fatal(err)
	}
	if migrated.Players.SeeClass || !migrated.Players.SeeHP || !migrated.Players.SeeRace || !migrated.Players.OpenSheets {
		t.Fatalf("migration lost visibility settings: %+v", migrated)
	}
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

	testSessionSettingsPostgres(t, s, id)
	testSessionKarmicDicePostgres(t, s, id)

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
