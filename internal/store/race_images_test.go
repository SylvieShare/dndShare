package store

import (
	"strings"
	"testing"

	"dndshare/internal/raceimages"
)

func TestRaceImageSchemaUsesItemStorageContract(t *testing.T) {
	for _, fragment := range []string{
		`"type" = 'item_icon'`,
		"icon_svg_id = NULL, icon_image_id = image.id",
		"race.user_id IS NULL",
		"race.parent_id IS NULL",
		"race.type_id = 8",
	} {
		if !strings.Contains(schemaRaceImagesSQL, fragment) {
			t.Fatalf("race image schema must contain %q", fragment)
		}
	}
	for _, image := range raceimages.Catalog {
		schema := schemaRaceImagesSQL
		if image.Subrace {
			schema = schemaSubraceImagesSQL
		}
		if !strings.Contains(schema, image.ObjectKey) {
			t.Fatalf("race image schema does not seed %q", image.ObjectKey)
		}
	}
}

func TestSubraceImageSchemaOnlyLinksChildRaceItems(t *testing.T) {
	for _, fragment := range []string{
		`"type" = 'item_icon'`,
		"icon_svg_id = NULL, icon_image_id = image.id",
		"subrace.user_id IS NULL",
		"subrace.parent_id IS NOT NULL",
		"subrace.type_id = 8",
	} {
		if !strings.Contains(schemaSubraceImagesSQL, fragment) {
			t.Fatalf("subrace image schema must contain %q", fragment)
		}
	}
}
