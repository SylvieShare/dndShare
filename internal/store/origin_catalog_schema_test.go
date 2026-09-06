package store

import (
	"strings"
	"testing"
)

func TestOriginCatalogSchemaSeparatesVariantsAndMaintainsBothDirections(t *testing.T) {
	required := []string{
		"'\u041f\u043e\u0434\u0440\u0430\u0441\u044b'",
		"'\u041f\u043e\u0434\u043a\u043b\u0430\u0441\u0441\u044b'",
		"'item_type', 16",
		"'item_type', 17",
		"UPDATE dndshare.item SET type_id = 16 WHERE type_id = 8 AND parent_id IS NOT NULL",
		"UPDATE dndshare.item SET type_id = 17 WHERE type_id = 9 AND parent_id IS NOT NULL",
		"'{race}'",
		"'{class}'",
		"'{subraces}'",
		"'{subclasses}'",
		"normalize_origin_item_relation",
		"refresh_origin_reverse_relation",
		"item_sync_origin_reverse_relation",
		"UPDATE OF type_id, parent_id, data, user_id",
		"UPDATE OF type_id, parent_id, data, user_id, name",
		"child.user_id IS NOT DISTINCT FROM parent.user_id",
		"cannot reference a private parent owned by another user",
		"must reference a base item",
		"'required', true",
	}
	for _, fragment := range required {
		if !strings.Contains(schemaOriginCatalogsSQL, fragment) {
			t.Errorf("origin catalogue migration is missing %q", fragment)
		}
	}
}

func TestOriginCatalogFeatureSchemasReferenceDedicatedTypes(t *testing.T) {
	for _, fragment := range []string{
		"field ->> 'key' = 'subrace_ids'",
		"'filter_path', 'subrace_ids.id'",
		"'filter_item_type', 16",
		"'{item_type}', '16'::jsonb",
		"field ->> 'key' = 'subclass_ids'",
		"'filter_path', 'subclass_ids.id'",
		"'filter_item_type', 17",
		"'{item_type}', '17'::jsonb",
	} {
		if !strings.Contains(schemaOriginCatalogsSQL, fragment) {
			t.Errorf("feature schemas do not reference the dedicated variant type: %q", fragment)
		}
	}
}
