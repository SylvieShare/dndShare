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
	if len(schemaParts) < 12 {
		t.Fatal("schema manifest is incomplete")
	}
	legacyLast := schemaParts[len(schemaParts)-12]
	halfCaster := schemaParts[len(schemaParts)-11]
	sessionSecurity := schemaParts[len(schemaParts)-10]
	sharedChannelDivinity := schemaParts[len(schemaParts)-9]
	spellbookTabs := schemaParts[len(schemaParts)-8]
	sacredWeaponEffect := schemaParts[len(schemaParts)-7]
	spellbookGrantCleanup := schemaParts[len(schemaParts)-6]
	sessionNPCBestiary := schemaParts[len(schemaParts)-5]
	sessionSceneLocation := schemaParts[len(schemaParts)-4]
	sessionSceneVisualSource := schemaParts[len(schemaParts)-3]
	sessionEventActorItem := schemaParts[len(schemaParts)-2]
	journals := schemaParts[len(schemaParts)-1]
	if legacyLast.name != legacySchemaBootstrapLast {
		t.Fatalf("legacy bootstrap must end at %q, got %q", legacySchemaBootstrapLast, legacyLast.name)
	}
	if halfCaster.name != "half-caster-spellcasting" || halfCaster.sql != schemaHalfCasterSpellcastingSQL {
		t.Fatalf("half-caster migration must be the first versioned migration after the legacy baseline")
	}
	if sessionSecurity.name != "session-security" || sessionSecurity.sql != schemaSessionSecuritySQL {
		t.Fatalf("session security indexes must run after the half-caster data migration")
	}
	if sharedChannelDivinity.name != "shared-channel-divinity" || sharedChannelDivinity.sql != schemaSharedChannelDivinitySQL {
		t.Fatalf("shared Channel Divinity must run after the session security migration")
	}
	if spellbookTabs.name != "spellbook-tabs" || spellbookTabs.sql != schemaSpellbookTabsSQL {
		t.Fatalf("spellbook tabs migration must run after the shared Channel Divinity migration")
	}
	if sacredWeaponEffect.name != "sacred-weapon-effect" || sacredWeaponEffect.sql != schemaSacredWeaponEffectSQL {
		t.Fatalf("Sacred Weapon effect must run after the spellbook tabs migration")
	}
	if spellbookGrantCleanup.name != "spellbook-grant-cleanup" || spellbookGrantCleanup.sql != schemaSpellbookGrantCleanupSQL {
		t.Fatalf("spellbook grant cleanup must run after the Sacred Weapon migration")
	}
	if sessionNPCBestiary.name != "session-npc-bestiary" || sessionNPCBestiary.sql != schemaSessionNPCBestiarySQL {
		t.Fatalf("session NPC bestiary link must run after the spellbook grant cleanup migration")
	}
	if sessionSceneLocation.name != "session-scene-location" || sessionSceneLocation.sql != schemaSessionSceneLocationSQL {
		t.Fatalf("session scene location link must run after the NPC bestiary migration")
	}
	if sessionSceneVisualSource.name != "session-scene-visual-source" || sessionSceneVisualSource.sql != schemaSessionSceneVisualSourceSQL {
		t.Fatalf("session scene visual source constraint must run after the location link migration")
	}
	if sessionEventActorItem.name != "session-event-actor-item" || sessionEventActorItem.sql != schemaSessionEventActorItemSQL {
		t.Fatalf("session event actor item link must run after the scene visual source migration")
	}
	if journals.name != "journals" || journals.sql != schemaJournalsSQL {
		t.Fatalf("journals migration must run after the session event actor item migration")
	}
}
