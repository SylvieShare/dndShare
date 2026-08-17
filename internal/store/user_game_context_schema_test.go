package store

import (
	"strings"
	"testing"
)

func TestHandbookSchemaDefinesUserGameContext(t *testing.T) {
	for _, fragment := range []string{
		"ADD COLUMN IF NOT EXISTS source_version_id int8",
		"idx_users_source_version_id",
		"set_default_user_source_version",
		"users_default_source_version",
		"ALTER COLUMN source_version_id SET NOT NULL",
	} {
		if !strings.Contains(schemaHandbookSQL, fragment) {
			t.Fatalf("handbook schema must contain %q", fragment)
		}
	}
}

func TestUserGameContextQueryJoinsEditionToSystem(t *testing.T) {
	for _, fragment := range []string{
		"JOIN dndshare.source_version sv ON sv.id = u.source_version_id",
		"JOIN dndshare.source src ON src.id = sv.source_id",
	} {
		if !strings.Contains(userGameContextQuery, fragment) {
			t.Fatalf("game context query must contain %q", fragment)
		}
	}
}
