package store

import (
	"strings"
	"testing"
)

func TestItemIconSchemaMigratesAndKeepsOneFormat(t *testing.T) {
	for _, fragment := range []string{
		"ALTER TABLE dndshare.item RENAME COLUMN svg_id TO icon_svg_id",
		"icon_image_id int8 NULL REFERENCES dndshare.storage_image(id) ON DELETE SET NULL",
		"CHECK (num_nonnulls(icon_svg_id, icon_image_id) <= 1)",
	} {
		if !strings.Contains(schemaHandbookSQL, fragment) {
			t.Fatalf("handbook schema must contain %q", fragment)
		}
	}
}
