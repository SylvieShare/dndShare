package store

import (
	"strings"
	"testing"
)

func TestSessionScenesMigrateToTwoNestedGraphs(t *testing.T) {
	for _, fragment := range []string{
		"CREATE TABLE IF NOT EXISTS dndshare.session_scene_edge",
		"CREATE TABLE IF NOT EXISTS dndshare.session_scene_item_edge",
		"ALTER TABLE dndshare.session_scene ADD COLUMN IF NOT EXISTS position_x",
		"ALTER TABLE dndshare.session_scene_item ADD COLUMN IF NOT EXISTS position_x",
		`ALTER TABLE dndshare.session_scene_item DROP COLUMN "order"`,
	} {
		if !strings.Contains(schemaSessionsSQL, fragment) {
			t.Fatalf("session schema must contain %q", fragment)
		}
	}
	if strings.Contains(schemaSessionsSQL, `"order"  int8 NOT NULL`) {
		t.Fatal("new scene-item schema must not recreate the legacy list order")
	}
}
