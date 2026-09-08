package store

import (
	"os"
	"regexp"
	"sort"
	"strings"
	"testing"
)

func TestEverySchemaFileIsEmbeddedAndRegistered(t *testing.T) {
	entries, err := os.ReadDir("schema")
	if err != nil {
		t.Fatal(err)
	}
	var files []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".sql") {
			files = append(files, entry.Name())
		}
	}
	sort.Strings(files)

	source, err := os.ReadFile("schema.go")
	if err != nil {
		t.Fatal(err)
	}
	matches := regexp.MustCompile(`//go:embed schema/([^\s]+\.sql)`).FindAllStringSubmatch(string(source), -1)
	var embedded []string
	for _, match := range matches {
		embedded = append(embedded, match[1])
	}
	sort.Strings(embedded)

	if strings.Join(files, "\n") != strings.Join(embedded, "\n") {
		t.Fatalf("schema files and go:embed declarations differ\nfiles: %v\nembedded: %v", files, embedded)
	}
	if len(schemaParts) != len(embedded) {
		t.Fatalf("schemaParts has %d entries, but %d schema files are embedded", len(schemaParts), len(embedded))
	}
	for _, file := range files {
		data, err := os.ReadFile("schema/" + file)
		if err != nil {
			t.Fatal(err)
		}
		matches := 0
		for _, part := range schemaParts {
			if part.sql == string(data) {
				matches++
			}
		}
		if matches != 1 {
			t.Fatalf("schema file %s must appear exactly once in schemaParts, got %d", file, matches)
		}
	}
	seen := make(map[string]bool, len(schemaParts))
	for _, part := range schemaParts {
		if strings.TrimSpace(part.name) == "" || strings.TrimSpace(part.sql) == "" {
			t.Fatalf("schema part must have a non-empty name and SQL: %#v", part)
		}
		if seen[part.name] {
			t.Fatalf("duplicate schema part name %q", part.name)
		}
		seen[part.name] = true
	}
}

func TestVersionedMigrationsRunAfterClassActionAutomation(t *testing.T) {
	want := []string{
		legacySchemaBootstrapLast, "half-caster-spellcasting", "session-security",
		"shared-channel-divinity", "spellbook-tabs", "sacred-weapon-effect",
		"spellbook-grant-cleanup", "session-npc-bestiary", "session-scene-location",
		"session-scene-visual-source", "session-event-actor-item", "journals",
		"origin-catalogs", "item-rich-descriptions", "potion-rich-descriptions",
		"story-abilities", "personal-character-journal", "journal-editing", "journal-entry-audit",
	}
	baseline := -1
	for i, part := range schemaParts {
		if part.name == legacySchemaBootstrapLast {
			baseline = i
			break
		}
	}
	if baseline < 0 || len(schemaParts) < baseline+len(want) {
		t.Fatal("schema manifest is incomplete")
	}
	for i, name := range want {
		if got := schemaParts[baseline+i].name; got != name {
			t.Fatalf("migration after baseline at offset %d: want %s, got %s", i, name, got)
		}
	}
}
