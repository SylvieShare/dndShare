package store

import (
	"context"
	"sync"
	"testing"
)

// Shares the disposable schema from TestSessionDisplayCodesMigrationAndLookup.
func testSessionSettingsPostgres(t *testing.T, s *Store, sessionID int64) {
	t.Helper()
	ctx := context.Background()
	session, err := s.GetGameSession(ctx, sessionID)
	if err != nil {
		t.Fatal(err)
	}
	if session.Settings != (SessionSettings{Players: SessionPlayerSettings{SeeClass: true, SeeRace: true, OpenSheets: true}}) {
		t.Fatalf("defaults: %+v", session.Settings)
	}
	if err := s.UpdateSessionSetting(ctx, sessionID, "players.seeHp", true); err != nil {
		t.Fatal(err)
	}
	if err := s.UpdateSessionSetting(ctx, sessionID, "players.seeClass", false); err != nil {
		t.Fatal(err)
	}
	session, err = s.GetGameSession(ctx, sessionID)
	if err != nil || session.Settings != (SessionSettings{Players: SessionPlayerSettings{SeeRace: true, SeeHP: true, OpenSheets: true}}) {
		t.Fatalf("persisted flags: %+v %v", session.Settings, err)
	}
	// Independent concurrent updates must preserve each other and unknown sections.
	if _, err := s.pool.Exec(ctx, `UPDATE dndshare.session SET settings = settings || '{"future":{"mode":"test"}}'::jsonb WHERE id = $1`, sessionID); err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	failures := make(chan error, 2)
	for _, key := range []string{"combat.autoRollNpcHp", "players.seeClass"} {
		wg.Add(1)
		go func(key string) { defer wg.Done(); failures <- s.UpdateSessionSetting(ctx, sessionID, key, true) }(key)
	}
	wg.Wait()
	close(failures)
	for err := range failures {
		if err != nil {
			t.Fatal(err)
		}
	}
	session, err = s.GetGameSession(ctx, sessionID)
	if err != nil || !session.Settings.Combat.AutoRollNpcHP || !session.Settings.Players.SeeClass || !session.Settings.Players.SeeHP {
		t.Fatalf("parallel updates: %+v %v", session.Settings, err)
	}
	var future string
	if err := s.pool.QueryRow(ctx, `SELECT settings #>> '{future,mode}' FROM dndshare.session WHERE id = $1`, sessionID).Scan(&future); err != nil || future != "test" {
		t.Fatalf("unknown section lost: %q %v", future, err)
	}
	if err := s.UpdateSessionSetting(ctx, sessionID, "owner_user_id", true); err == nil {
		t.Fatal("invalid key accepted")
	}
	_, err = s.pool.Exec(ctx, `
 CREATE TABLE dndshare."char" (id bigint, uuid uuid DEFAULT gen_random_uuid(), user_id bigint, data jsonb, version bigint DEFAULT 1, deleted bool DEFAULT false, public_visible bool DEFAULT false, template_id bigint, icon_image_id bigint);
 CREATE TABLE dndshare.char_template (id bigint, name text);
 CREATE TABLE dndshare.storage_image (id bigint, url text, deleted bool);
 CREATE TABLE dndshare.session_participant (id bigserial, session_id bigint, char_id bigint, user_id bigint, role text DEFAULT 'player', color text, sort_order int DEFAULT 0);
 INSERT INTO dndshare.char_template VALUES(1,'DND5');
 INSERT INTO dndshare."char"(id,user_id,data,template_id) VALUES(1,10,'{"values":{"name":"One"}}',1),(2,20,'{"values":{"name":"Two"}}',1);
 INSERT INTO dndshare.session_participant(session_id,char_id,user_id) VALUES($1,1,10),($1,2,20);`, sessionID)
	if err != nil {
		t.Fatal(err)
	}
	parts, err := s.GetSessionParticipants(ctx, sessionID)
	if err != nil || len(parts) != 2 || parts[0].UserID != 10 {
		t.Fatalf("participants: %+v %v", parts, err)
	}
	for _, reader := range []struct {
		id    int64
		count int
	}{{1, 2}, {10, 1}, {20, 1}, {30, 0}} {
		rows, err := s.PollChars(ctx, []PollItem{{CharID: 1, Version: 0}, {CharID: 2, Version: 0}}, reader.id)
		if err != nil || len(rows) != reader.count {
			t.Fatalf("poll reader %d: %+v %v", reader.id, rows, err)
		}
	}
}
