package store

import (
	"strings"
	"testing"

	"dndshare/internal/systemimages"
)

func TestSessionWorldSchemaUsesTreeAndExplicitAssociations(t *testing.T) {
	for _, fragment := range []string{
		"CREATE TABLE IF NOT EXISTS dndshare.session_location",
		"parent_location_id int8 NULL REFERENCES dndshare.session_location(id) ON DELETE RESTRICT",
		"session_location_not_own_parent",
		"idx_session_location_session_order",
		"CREATE TABLE IF NOT EXISTS dndshare.session_npc",
		"race_item_id int8 NULL REFERENCES dndshare.item(id) ON DELETE SET NULL",
		"ADD COLUMN IF NOT EXISTS race_item_id",
		"custom_image_id int8 NULL REFERENCES dndshare.storage_image(id) ON DELETE SET NULL",
		"ON DELETE CASCADE",
	} {
		if !strings.Contains(schemaSessionWorldSQL, fragment) {
			t.Fatalf("session world schema must contain %q", fragment)
		}
	}
	if strings.Contains(schemaSessionWorldSQL, "session_location_edge") {
		t.Fatal("locations must remain a tree without graph edges")
	}
	if strings.Contains(schemaSessionWorldSQL, "session_npc_location") || strings.Contains(schemaSessionWorldSQL, "session_npc_relation") {
		t.Fatal("legacy NPC relation tables must not be recreated")
	}
	if strings.Contains(schemaSessionWorldSQL, "session_scene_location") || strings.Contains(schemaSessionWorldSQL, "session_npc_scene") {
		t.Fatal("scenario associations must use universal relations")
	}
}

func TestSessionWorldSchemaRunsAfterSessionTables(t *testing.T) {
	if schemaParts[len(schemaParts)-1].name != "session-entities" {
		t.Fatalf("last schema part = %q, want session-entities", schemaParts[len(schemaParts)-1].name)
	}
}

func TestSessionEntitiesSchemaAddsQuestsAndUniversalRelations(t *testing.T) {
	for _, fragment := range []string{
		"CREATE TABLE IF NOT EXISTS dndshare.session_quest",
		"ADD COLUMN IF NOT EXISTS goal text NULL",
		"ADD COLUMN IF NOT EXISTS condition_text text NULL",
		"ADD COLUMN IF NOT EXISTS reward text NULL",
		"ADD COLUMN IF NOT EXISTS consequences text NULL",
		"ADD COLUMN IF NOT EXISTS notes text NULL",
		"SET notes = description",
		"DROP COLUMN IF EXISTS description",
		"CREATE TABLE IF NOT EXISTS dndshare.session_entity_relation",
		"'location', 'npc', 'material', 'quest', 'scene'",
		"to_regclass('dndshare.session_scene_location')",
		"to_regclass('dndshare.session_npc_scene')",
		"DROP TABLE IF EXISTS dndshare.session_scene_location",
		"DROP TABLE IF EXISTS dndshare.session_npc_scene",
		"session_entity_relation_order_check",
	} {
		if !strings.Contains(schemaSessionEntitiesSQL, fragment) {
			t.Fatalf("session entity schema must contain %q", fragment)
		}
	}
}

func TestSessionImagesSchemaUnifiesEntityReferences(t *testing.T) {
	for _, fragment := range []string{
		"CREATE TABLE IF NOT EXISTS dndshare.session_image_catalog",
		"ALTER TABLE dndshare.session_chapter ADD COLUMN IF NOT EXISTS image_id",
		"ALTER TABLE dndshare.session_scene ADD COLUMN IF NOT EXISTS image_id",
		"ALTER TABLE dndshare.session_location ADD COLUMN IF NOT EXISTS image_id",
		"ALTER TABLE dndshare.session_npc ADD COLUMN IF NOT EXISTS image_id",
		"FOREIGN KEY (image_id) REFERENCES dndshare.storage_image(id) ON DELETE RESTRICT",
	} {
		if !strings.Contains(schemaSessionImagesSQL, fragment) {
			t.Fatalf("session image schema must contain %q", fragment)
		}
	}
	for _, image := range systemimages.Catalog {
		if !strings.Contains(schemaSessionImagesSQL, "'"+image.CatalogKey+"'") {
			t.Fatalf("session image schema must contain catalog key %q", image.CatalogKey)
		}
		if !strings.Contains(schemaSessionImagesSQL, "'"+image.ObjectKey+"'") {
			t.Fatalf("session image schema must contain object key %q", image.ObjectKey)
		}
	}
}
