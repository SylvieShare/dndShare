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
