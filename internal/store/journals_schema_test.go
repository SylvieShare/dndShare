package store

import (
	"strings"
	"testing"
)

func TestJournalSchemaKeepsSharedContentOutOfCharacterJSON(t *testing.T) {
	required := []string{
		"CREATE TABLE dndshare.journal (",
		"CREATE TABLE dndshare.character_journal (",
		"CREATE TABLE dndshare.journal_section (",
		"CREATE TABLE dndshare.journal_entry (",
		"journal_owner_xor_session",
		"journal_session_key UNIQUE (session_id)",
		"source_scene_item_id",
		"source_snapshot",
		"COALESCE(data::jsonb->'values', '{}'::jsonb) - 'diary'",
	}
	for _, fragment := range required {
		if !strings.Contains(schemaJournalsSQL, fragment) {
			t.Fatalf("journal migration must contain %q", fragment)
		}
	}
}
