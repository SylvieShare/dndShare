package store

import (
	"strings"
	"testing"
)

func TestSessionPresentationSchemaKeepsMaterialsAndOneLiveState(t *testing.T) {
	for _, fragment := range []string{
		"CREATE TABLE IF NOT EXISTS dndshare.session_material",
		"presentation_material_id",
		"presentation_track_id",
		"presentation_crossfade_sec",
		"ADD COLUMN IF NOT EXISTS material_id",
		"CREATE TABLE IF NOT EXISTS dndshare.session_presentation_state",
		"mode IN ('idle', 'material', 'scene', 'combat')",
		"effect IN ('none', 'rain', 'fog', 'embers', 'snow', 'storm')",
		"transition IN ('cut', 'fade')",
	} {
		if !strings.Contains(schemaSessionPresentationSQL, fragment) {
			t.Fatalf("session presentation schema must contain %q", fragment)
		}
	}
}

func TestSessionMaterialLinksSchemaMigratesLegacyScopes(t *testing.T) {
	for _, fragment := range []string{
		"CREATE TABLE IF NOT EXISTS dndshare.session_material_chapter",
		"CREATE TABLE IF NOT EXISTS dndshare.session_material_scene",
		"WHERE scope = 'chapter'",
		"WHERE scope = 'scene'",
		"DROP COLUMN IF EXISTS scope",
		"DROP COLUMN IF EXISTS chapter_id",
		"DROP COLUMN IF EXISTS scene_id",
	} {
		if !strings.Contains(schemaMaterialLinksSQL, fragment) {
			t.Fatalf("material links schema must contain %q", fragment)
		}
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
