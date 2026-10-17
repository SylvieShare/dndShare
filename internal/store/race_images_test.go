package store

import (
	"strings"
	"testing"
)

func TestRaceCoverAssignmentOnlyClearsTheMigratedLegacyIcon(t *testing.T) {
	for _, fragment := range []string{
		"cover_image_id = $1",
		"CASE WHEN icon_image_id = $1 THEN NULL ELSE icon_image_id END",
		"user_id IS NULL",
		"type_id = CASE WHEN $3::boolean THEN 16 ELSE 8 END",
		"cover_image_id IS NULL OR cover_image_id = $1",
		"parent_id IS NOT NULL",
		"parent_id IS NULL",
	} {
		if !strings.Contains(assignSystemRaceCoverSQL, fragment) {
			t.Fatalf("race cover assignment must contain %q", fragment)
		}
	}
}
