package store

import (
	"strings"
	"testing"
)

func TestSystemSpellRuneQueriesUseItemStorageContract(t *testing.T) {
	for _, fragment := range []string{
		"user_id IS NULL",
		"type_id = 5",
		"icon_image_id",
		"FOR UPDATE",
	} {
		if !strings.Contains(systemSpellRuneItemsSQL, fragment) {
			t.Fatalf("spell rune item query must contain %q", fragment)
		}
	}
	for _, fragment := range []string{
		`"type" = 'retired_spell_icon'`,
		"deleted = true",
		"NOT EXISTS (SELECT 1 FROM dndshare.item",
	} {
		if !strings.Contains(retireSpellRuneImageSQL, fragment) {
			t.Fatalf("spell rune retirement query must contain %q", fragment)
		}
	}
}
