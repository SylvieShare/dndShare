package store

import (
	"strings"
	"testing"
)

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
