package store

import (
	"strings"
	"testing"
)

func TestItemTypesProjectRasterIconsWithoutSVGFallback(t *testing.T) {
	for _, fragment := range []string{
		"it.parent_type_id",
		"it.icon_image_id",
		"icon.url AS icon_image_url",
		"LEFT JOIN dndshare.storage_image icon",
		"it.cover_image_id",
		"cover.url AS cover_image_url",
		"LEFT JOIN dndshare.storage_image cover",
	} {
		if !strings.Contains(itemTypeSelect, fragment) {
			t.Fatalf("item type query must contain %q", fragment)
		}
	}
	if strings.Contains(itemTypeSelect, "svg_storage") || strings.Contains(itemTypeSelect, "it.svg_id") {
		t.Fatal("item type query must not retain the former SVG fallback")
	}
}

func TestStorageImagesStayActiveWhileReferencedByItemType(t *testing.T) {
	for _, fragment := range []string{"item_type.icon_image_id", "item_type.cover_image_id"} {
		if !strings.Contains(markStorageImageDeletedIfUnreferencedSQL, fragment) {
			t.Fatalf("storage image cleanup must preserve item type media referenced by %q", fragment)
		}
	}
}
