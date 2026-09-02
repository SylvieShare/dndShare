package store

import (
	"strings"
	"testing"
)

func TestSessionSceneLocationMigration(t *testing.T) {
	for _, fragment := range []string{
		"ADD COLUMN IF NOT EXISTS location_id",
		"ALTER COLUMN image_id DROP NOT NULL",
		"session_scene_visual_source_check",
		"image_id IS NOT NULL OR location_id IS NOT NULL",
		"session_scene_location_fk",
		"REFERENCES dndshare.session_location(id)",
		"ON DELETE SET NULL",
		"idx_session_scene_location_id",
	} {
		if !strings.Contains(schemaSessionSceneLocationSQL, fragment) {
			t.Fatalf("scene location schema must contain %q", fragment)
		}
	}
}
