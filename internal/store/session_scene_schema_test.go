package store

import (
	"strings"
	"testing"
)

func TestSessionScenesMigrateToTwoNestedGraphs(t *testing.T) {
	for _, fragment := range []string{
		"CREATE TABLE IF NOT EXISTS dndshare.session_scene_edge",
		"CREATE TABLE IF NOT EXISTS dndshare.session_scene_item_edge",
		"ALTER TABLE dndshare.session_chapter_edge ADD COLUMN IF NOT EXISTS bidirectional",
		"ALTER TABLE dndshare.session_scene_edge ADD COLUMN IF NOT EXISTS bidirectional",
		"ALTER TABLE dndshare.session_scene_item_edge ADD COLUMN IF NOT EXISTS bidirectional",
		"session_chapter_edge_unordered_pair_key",
		"session_scene_edge_unordered_pair_key",
		"session_scene_item_edge_unordered_pair_key",
		"ALTER TABLE dndshare.session_scene ADD COLUMN IF NOT EXISTS position_x",
		"ALTER TABLE dndshare.session_scene ADD COLUMN IF NOT EXISTS image_preset_key",
		"ALTER TABLE dndshare.session_scene ADD COLUMN IF NOT EXISTS status",
		"ALTER TABLE dndshare.session_scene ALTER COLUMN status SET DEFAULT 'none'",
		"session_scene_status_check",
		"ALTER TABLE dndshare.session_chapter ALTER COLUMN status SET DEFAULT 'none'",
		"ALTER TABLE dndshare.session_scene ALTER COLUMN image_preset_key SET NOT NULL",
		"ALTER TABLE dndshare.session_scene_item ADD COLUMN IF NOT EXISTS position_x",
		"ALTER TABLE dndshare.session_scene_item ADD COLUMN IF NOT EXISTS width",
		"ALTER TABLE dndshare.session_scene_item DROP COLUMN IF EXISTS color",
		`ALTER TABLE dndshare.session_scene_item DROP COLUMN "order"`,
	} {
		if !strings.Contains(schemaSessionsSQL, fragment) {
			t.Fatalf("session schema must contain %q", fragment)
		}
	}
	if strings.Contains(schemaSessionsSQL, `"order"  int8 NOT NULL`) {
		t.Fatal("new scene-item schema must not recreate the legacy list order")
	}
	if strings.Contains(schemaSessionsSQL, `color    varchar NULL`) {
		t.Fatal("scene-item color must be derived from the block type")
	}
}
