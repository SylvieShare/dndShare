package store

import (
	"strings"
	"testing"
)

func TestSystemItemMediaQueriesPreserveOwnershipAndSlots(t *testing.T) {
	for _, fragment := range []string{"user_id IS NULL", "FOR UPDATE"} {
		if !strings.Contains(lockSystemItemMediaTargetSQL, fragment) {
			t.Fatalf("system item lock query must contain %q", fragment)
		}
	}
	for _, fragment := range []string{"user_id", "system-item-media/%", "ON CONFLICT", "deleted = false"} {
		if !strings.Contains(upsertSystemItemMediaSQL, fragment) {
			t.Fatalf("system media upsert must contain %q", fragment)
		}
	}
	for _, fragment := range []string{"icon_svg_id = NULL", "icon_image_id = $1"} {
		if !strings.Contains(setSystemItemIconSQL, fragment) {
			t.Fatalf("system icon update must contain %q", fragment)
		}
	}
	if strings.Contains(setSystemItemCoverSQL, "icon_") || !strings.Contains(setSystemItemCoverSQL, "cover_image_id = $1") {
		t.Fatalf("cover update must remain independent from the icon: %s", setSystemItemCoverSQL)
	}
	for _, fragment := range []string{"icon_image_id", "cover_image_id", "FOR UPDATE"} {
		if !strings.Contains(lockSystemItemTypeMediaTargetSQL, fragment) {
			t.Fatalf("system item type lock query must contain %q", fragment)
		}
	}
	if !strings.Contains(setSystemItemTypeIconSQL, "icon_image_id = $1") {
		t.Fatalf("item type icon update is incomplete: %s", setSystemItemTypeIconSQL)
	}
	if !strings.Contains(setSystemItemTypeCoverSQL, "cover_image_id = $1") {
		t.Fatalf("item type cover update is incomplete: %s", setSystemItemTypeCoverSQL)
	}
}

func TestSystemItemMediaSchemaHasScopedUniqueKey(t *testing.T) {
	for _, fragment := range []string{
		"idx_storage_image_system_item_media_key",
		"UNIQUE INDEX",
		"user_id IS NULL",
		`"key" LIKE 'system-item-media/%'`,
	} {
		if !strings.Contains(schemaSystemItemMediaSQL, fragment) {
			t.Fatalf("system item media schema must contain %q", fragment)
		}
	}
}
