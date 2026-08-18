package store

import (
	"strings"
	"testing"

	"dndshare/internal/classimages"
)

func TestClassLoreCoversEveryBuiltInClass(t *testing.T) {
	for _, fragment := range []string{"short_description", "class_item.parent_id IS NULL", "class_item.type_id = 9"} {
		if !strings.Contains(schemaClassLoreSQL, fragment) {
			t.Fatalf("class lore schema must contain %q", fragment)
		}
	}
	for _, image := range classimages.Catalog {
		if !strings.Contains(schemaClassLoreSQL, "'"+image.Aliases[0]+"'") {
			t.Fatalf("class lore does not cover %q", image.Key)
		}
	}
	if paragraphs := strings.Count(schemaClassLoreSQL, "<p>"); paragraphs != len(classimages.Catalog)*3 {
		t.Fatalf("got %d lore paragraphs, want %d", paragraphs, len(classimages.Catalog)*3)
	}
}
