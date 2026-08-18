package store

import (
	"strings"
	"testing"

	"dndshare/internal/raceimages"
)

func TestRaceLoreSeedsShortAndLongDescriptions(t *testing.T) {
	for _, fragment := range []string{
		"field ->> 'key' = 'short_description'",
		"'{short_description}'",
		"'{description}'",
		"race.user_id IS NULL",
		"race.parent_id IS NULL",
		"race.type_id = 8",
	} {
		if !strings.Contains(schemaRaceLoreSQL, fragment) {
			t.Fatalf("race lore schema must contain %q", fragment)
		}
	}
	baseRaces := 0
	for _, image := range raceimages.Catalog {
		if image.Subrace {
			continue
		}
		baseRaces++
		if !strings.Contains(schemaRaceLoreSQL, "'"+image.Aliases[0]+"'") {
			t.Fatalf("race lore schema does not cover %q", image.Key)
		}
	}
	if paragraphs := strings.Count(schemaRaceLoreSQL, "<p>"); paragraphs != baseRaces*3 {
		t.Fatalf("got %d lore paragraphs, want %d", paragraphs, baseRaces*3)
	}
}
