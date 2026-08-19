package store

import (
	"strings"
	"testing"
)

func TestSystemBestiaryIconMigrationQueriesAreScopedAndNonDestructive(t *testing.T) {
	for _, query := range []string{auditSystemBestiaryIconMigrationSQL, applySystemBestiaryIconMigrationSQL} {
		for _, fragment := range []string{
			"user_id IS NULL",
			"type_id = 6",
			"icon_image_id IS NOT NULL",
			"id = ANY($1::bigint[])",
		} {
			if !strings.Contains(query, fragment) {
				t.Fatalf("bestiary image migration query must contain %q: %s", fragment, query)
			}
		}
	}
	for _, fragment := range []string{
		"cover_image_id IS NULL",
		"cover_image_id = icon_image_id",
		"icon_image_id = NULL",
		`SET "type" = 'item_cover'`,
	} {
		if !strings.Contains(applySystemBestiaryIconMigrationSQL, fragment) {
			t.Fatalf("bestiary image migration apply query must contain %q", fragment)
		}
	}
	for _, forbidden := range []string{"DELETE", "user_id IS NOT NULL"} {
		if strings.Contains(applySystemBestiaryIconMigrationSQL, forbidden) {
			t.Fatalf("bestiary image migration must not contain %q", forbidden)
		}
	}
}
