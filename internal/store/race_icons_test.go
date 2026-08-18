package store

import (
	"strings"
	"testing"
)

func TestSystemRaceIconQuerySeparatesBaseRacesAndSubraces(t *testing.T) {
	for _, fragment := range []string{
		"user_id IS NULL",
		"type_id = 8",
		"$2::boolean AND parent_id IS NOT NULL",
		"NOT $2::boolean AND parent_id IS NULL",
		"icon_image_id",
		"FOR UPDATE",
	} {
		if !strings.Contains(systemRaceIconItemsSQL, fragment) {
			t.Fatalf("system race icon query must contain %q", fragment)
		}
	}
}

func TestRetiredRaceIconKeepsImagesStillUsedAsCovers(t *testing.T) {
	for _, fragment := range []string{
		`"type" = 'retired_race_icon'`,
		"deleted = true",
		"img.user_id IS NULL",
		"i.icon_image_id = img.id",
		"i.cover_image_id = img.id",
	} {
		if !strings.Contains(retireRaceIconImageSQL, fragment) {
			t.Fatalf("retired race icon query must contain %q", fragment)
		}
	}
}
