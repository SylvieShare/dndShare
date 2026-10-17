package store

import (
	"strings"
	"testing"
)

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
