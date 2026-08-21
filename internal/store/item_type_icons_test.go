package store

import (
	"strings"
	"testing"
)

func TestHandbookTypeIconSchemaIsRegisteredAfterBuiltInTypes(t *testing.T) {
	iconIndex := -1
	weaponIndex := -1
	for index, part := range schemaParts {
		switch part.name {
		case "handbook-type-icons":
			iconIndex = index
			if part.sql == "" || part.sql != schemaHandbookTypeIconsSQL {
				t.Fatal("handbook type icon schema must be embedded")
			}
		case "weapon-catalog":
			weaponIndex = index
		}
	}
	if iconIndex < 0 {
		t.Fatal("handbook type icon schema is not registered")
	}
	if weaponIndex >= 0 && iconIndex >= weaponIndex {
		t.Fatal("handbook type icons must run before the final weapon catalogue migration")
	}
}

func TestHandbookTypeIconsReplaceTypeSVGsWithStaticRasterMedia(t *testing.T) {
	for _, fragment := range []string{
		"item_type_icon",
		"/static/handbook-types/1-weapons.png",
		"/static/handbook-types/13-transport.png",
		"SET icon_image_id = image.id",
		"JOIN inserted image ON image.\"key\" = seed.object_key",
		"ALTER TABLE dndshare.item_type DROP COLUMN svg_id",
	} {
		if !strings.Contains(schemaHandbookTypeIconsSQL, fragment) {
			t.Fatalf("handbook type icon schema must contain %q", fragment)
		}
	}
	if !strings.Contains(schemaHandbookSQL, "icon_image_id int8 NULL REFERENCES dndshare.storage_image(id) ON DELETE SET NULL") {
		t.Fatal("item_type must own a raster image reference")
	}
}

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
