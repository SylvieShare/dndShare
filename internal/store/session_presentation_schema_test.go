package store

import (
	"strings"
	"testing"
)

func TestSessionPresentationSchemaKeepsMaterialsAndOneLiveState(t *testing.T) {
	for _, fragment := range []string{
		"CREATE TABLE IF NOT EXISTS dndshare.session_material",
		"DROP COLUMN IF EXISTS presentation_material_id",
		"DROP COLUMN IF EXISTS presentation_track_id",
		"DROP COLUMN IF EXISTS presentation_crossfade_sec",
		"ADD COLUMN IF NOT EXISTS material_id",
		"CREATE TABLE IF NOT EXISTS dndshare.session_presentation_state",
		"ADD COLUMN IF NOT EXISTS broadcast_music",
		"ADD COLUMN IF NOT EXISTS show_health",
		"ADD COLUMN IF NOT EXISTS show_graveyard",
		"ADD COLUMN IF NOT EXISTS show_initiative",
		"mode IN ('idle', 'material', 'combat')",
		"WHERE mode = 'scene'",
		"DROP COLUMN IF EXISTS scene_id",
		"effect IN ('none', 'rain', 'fog', 'embers', 'snow', 'storm')",
		"transition IN ('cut', 'fade')",
	} {
		if !strings.Contains(schemaSessionPresentationSQL, fragment) {
			t.Fatalf("session presentation schema must contain %q", fragment)
		}
	}
	if strings.Contains(schemaSessionPresentationSQL, "mode IN ('idle', 'material', 'scene', 'combat')") {
		t.Fatal("scene must not remain an available presentation mode")
	}
}

func TestLegacyMaterialScenarioLinksAreRemovedAfterNoteMigration(t *testing.T) {
	for _, fragment := range []string{
		"to_regclass('dndshare.session_material_scene')",
		"'material', link.material_id, 'scene'",
		"WHERE scope = 'scene'",
		"DROP TABLE IF EXISTS dndshare.session_material_chapter",
		"DROP TABLE IF EXISTS dndshare.session_material_scene",
		"DROP COLUMN IF EXISTS scope",
		"DROP COLUMN IF EXISTS chapter_id",
		"DROP COLUMN IF EXISTS scene_id",
		"item.type = 'material'",
		"DELETE FROM dndshare.session_entity_relation",
	} {
		if !strings.Contains(schemaSessionEntitiesSQL, fragment) {
			t.Fatalf("session entity schema must contain %q", fragment)
		}
	}
	if strings.Contains(schemaMaterialLinksSQL, "CREATE TABLE") {
		t.Fatal("material context tables must not be recreated")
	}
}

func TestSessionMaterialTypesSchemaSeparatesAssetsAndWrittenContent(t *testing.T) {
	for _, fragment := range []string{
		"RENAME COLUMN image_id TO asset_id",
		"kind IN ('image', 'video', 'text', 'note', 'map')",
		"ADD COLUMN IF NOT EXISTS content text",
		"ADD COLUMN IF NOT EXISTS note_style",
		"ADD COLUMN IF NOT EXISTS map_data jsonb",
		"session_material_payload_check",
		"'parchment', 'letter', 'dossier', 'arcane'",
	} {
		if !strings.Contains(schemaSessionMaterialTypesSQL, fragment) {
			t.Fatalf("typed material schema must contain %q", fragment)
		}
	}
}

func TestSessionTimerSchemaKeepsPerTimerBroadcastFlag(t *testing.T) {
	for _, fragment := range []string{
		"broadcast     bool DEFAULT false NOT NULL",
		"ADD COLUMN IF NOT EXISTS broadcast bool DEFAULT false NOT NULL",
	} {
		if !strings.Contains(schemaSessionTimersSQL, fragment) {
			t.Fatalf("session timer schema must contain %q", fragment)
		}
	}
}
