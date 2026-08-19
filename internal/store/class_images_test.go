package store

import (
	"strings"
	"testing"

	"dndshare/internal/classimages"
)

func TestClassImageSchemaUsesItemStorageContract(t *testing.T) {
	for _, fragment := range []string{
		`"type" = 'item_icon'`,
		"icon_svg_id = NULL, icon_image_id = image.id",
		"class_item.user_id IS NULL",
		"class_item.parent_id IS NULL",
		"class_item.type_id = 9",
		`current_image."key" LIKE 'system-class-images/%'`,
	} {
		if !strings.Contains(schemaClassImagesSQL, fragment) {
			t.Fatalf("class image schema must contain %q", fragment)
		}
	}
	for _, image := range classimages.Catalog {
		if !strings.Contains(schemaClassImagesSQL, image.ObjectKey) {
			t.Fatalf("class image schema does not seed %q", image.ObjectKey)
		}
	}
}

func TestClassImageSyncDoesNotReplaceMCPIcon(t *testing.T) {
	for _, fragment := range []string{
		"class_item.icon_image_id IS NULL",
		`current_image."key" LIKE 'system-class-images/%'`,
	} {
		if !strings.Contains(attachSystemClassImageSQL, fragment) {
			t.Fatalf("class image sync query must preserve non-legacy icons using %q", fragment)
		}
	}
}
