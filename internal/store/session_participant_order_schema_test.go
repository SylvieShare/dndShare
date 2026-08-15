package store

import (
	"strings"
	"testing"
)

func TestSessionParticipantOrderMigration(t *testing.T) {
	for _, fragment := range []string{
		"sort_order int4 NOT NULL",
		"ALTER TABLE dndshare.session_participant ADD COLUMN IF NOT EXISTS sort_order",
		"row_number() OVER (PARTITION BY session_id ORDER BY joined_at, id)",
		"ALTER TABLE dndshare.session_participant ALTER COLUMN sort_order SET NOT NULL",
		"session_participant_session_id_sort_order_key UNIQUE (session_id, sort_order)",
	} {
		if !strings.Contains(schemaSessionsSQL, fragment) {
			t.Fatalf("session participant schema must contain %q", fragment)
		}
	}
}

func TestSessionParticipantBelongsToOneSession(t *testing.T) {
	for _, fragment := range []string{
		"session_participant_char_id_key UNIQUE (char_id)",
		"linked_session.deleted = true",
		"DELETE FROM dndshare.session_participant older",
		"older.char_id = newer.char_id",
		"ALTER TABLE dndshare.\"session\" DROP COLUMN IF EXISTS status",
	} {
		if !strings.Contains(schemaSessionsSQL, fragment) {
			t.Fatalf("session schema must contain %q", fragment)
		}
	}
}
