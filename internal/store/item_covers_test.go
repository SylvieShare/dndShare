package store

import (
	"strings"
	"testing"
)

func TestSystemItemCoverQueriesKeepCoverSeparateFromIcon(t *testing.T) {
	for _, fragment := range []string{"user_id IS NULL", "type_id = $2", "cover_image_id", "FOR UPDATE"} {
		if !strings.Contains(systemItemCoverItemsSQL, fragment) {
			t.Fatalf("item cover query must contain %q", fragment)
		}
	}
	for _, fragment := range []string{`"type" = 'retired_item_cover'`, "deleted = true", "i.cover_image_id = img.id", "i.icon_image_id = img.id"} {
		if !strings.Contains(retireItemCoverImageSQL, fragment) {
			t.Fatalf("item cover retirement query must contain %q", fragment)
		}
	}
}
