package store

import (
	"strings"
	"testing"
)

func TestAppendContentScopeSQLSelectedSources(t *testing.T) {
	version := int64(12)
	args := []any{"existing"}
	where := appendContentScopeSQL(nil, &args, ContentScope{IDs: []int64{4, 7}, RestrictToIDs: true, SourceVersionID: &version})
	if len(where) != 1 {
		t.Fatalf("expected one scope clause, got %d", len(where))
	}
	if !strings.Contains(where[0], "ics.content_source_id = ANY($2)") {
		t.Fatalf("source allowlist missing from SQL: %s", where[0])
	}
	if !strings.Contains(where[0], "ivc.source_version_id = $3") || !strings.Contains(where[0], "<> 'legacy'") {
		t.Fatalf("edition compatibility missing from SQL: %s", where[0])
	}
}

func TestAppendContentScopeSQLEmptySelection(t *testing.T) {
	args := []any{}
	where := appendContentScopeSQL(nil, &args, ContentScope{RestrictToIDs: true})
	if len(where) != 1 || !strings.Contains(where[0], "AND FALSE") {
		t.Fatalf("empty explicit selection must not mean all sources: %v", where)
	}
}

func TestAppendContentScopeSQLAllCompatibleSources(t *testing.T) {
	version := int64(12)
	args := []any{}
	where := appendContentScopeSQL(nil, &args, ContentScope{SourceVersionID: &version, AllowLegacy: true})
	if len(where) != 1 {
		t.Fatalf("expected edition scope clause, got %d", len(where))
	}
	if strings.Contains(where[0], "content_source_id = ANY") {
		t.Fatalf("all-sources mode unexpectedly has an allowlist: %s", where[0])
	}
	if strings.Contains(where[0], "<> 'legacy'") {
		t.Fatalf("legacy filter must be disabled: %s", where[0])
	}
}

func TestHandbookSchemaBackfillsBestiaryContentSources(t *testing.T) {
	for _, fragment := range []string{
		"i.data #>> '{identity,source}'",
		"INSERT INTO dndshare.content_source",
		"INSERT INTO dndshare.item_content_source",
		"WHERE i.type_id = 6",
	} {
		if !strings.Contains(schemaHandbookSQL, fragment) {
			t.Fatalf("bestiary source migration is missing %q", fragment)
		}
	}
}
