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

func TestItemCoverIsIndependentFromIconFormats(t *testing.T) {
	for _, fragment := range []string{
		"cover_image_id int8 NULL REFERENCES dndshare.storage_image(id) ON DELETE SET NULL",
		"idx_item_cover_image_id",
		"CHECK (num_nonnulls(icon_svg_id, icon_image_id) <= 1)",
	} {
		if !strings.Contains(schemaHandbookSQL, fragment) {
			t.Fatalf("handbook schema must contain %q", fragment)
		}
	}
	if strings.Contains(schemaHandbookSQL, "num_nonnulls(icon_svg_id, icon_image_id, cover_image_id)") {
		t.Fatal("cover must not participate in the mutually exclusive icon formats")
	}
}

func TestBestiaryArtworkMigratesOutOfRulesJSON(t *testing.T) {
	for _, fragment := range []string{
		"btrim(data ->> 'image_url') AS image_url",
		`INSERT INTO dndshare.storage_image (user_id, "key", url, "type")`,
		"VALUES (creature.user_id, NULL, creature.image_url, 'item_cover')",
		"cover_image_id = saved_image_id",
		"SET data = data - 'image_url'",
		"field ->> 'key' <> 'image_url'",
	} {
		if !strings.Contains(schemaHandbookSQL, fragment) {
			t.Fatalf("handbook schema must contain bestiary image migration %q", fragment)
		}
	}
}
