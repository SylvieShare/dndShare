package store

import (
	"strings"
	"testing"

	"dndshare/internal/raceimages"
)

func TestRaceImageSchemaUsesItemStorageContract(t *testing.T) {
	for _, fragment := range []string{
		`"type" = 'item_cover'`,
		"cover_image_id = image.id",
		"CASE WHEN race.icon_image_id = image.id THEN NULL ELSE race.icon_image_id END",
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

func TestRaceCoverAssignmentOnlyClearsTheMigratedLegacyIcon(t *testing.T) {
	for _, fragment := range []string{
		"cover_image_id = $1",
		"CASE WHEN icon_image_id = $1 THEN NULL ELSE icon_image_id END",
		"user_id IS NULL",
		"type_id = 8",
		"parent_id IS NOT NULL",
		"parent_id IS NULL",
	} {
		if !strings.Contains(assignSystemRaceCoverSQL, fragment) {
			t.Fatalf("race cover assignment must contain %q", fragment)
		}
	}
}

func TestSubraceImageSchemaOnlyLinksChildRaceItems(t *testing.T) {
	for _, fragment := range []string{
		`"type" = 'item_cover'`,
		"cover_image_id = image.id",
		"CASE WHEN subrace.icon_image_id = image.id THEN NULL ELSE subrace.icon_image_id END",
		"subrace.user_id IS NULL",
		"subrace.parent_id IS NOT NULL",
		"subrace.type_id = 8",
	} {
		if !strings.Contains(schemaSubraceImagesSQL, fragment) {
			t.Fatalf("subrace image schema must contain %q", fragment)
		}
	}
}
