package web

import (
	"testing"

	"dndshare/internal/store"
)

func TestEncounterHealthUsesPublicWordedBands(t *testing.T) {
	tests := []struct {
		name    string
		current float64
		maximum float64
		known   bool
		npc     bool
		kind    string
		label   string
	}{
		{name: "healthy", current: 51, maximum: 100, known: true, kind: "healthy", label: "Здоров"},
		{name: "wounded", current: 50, maximum: 100, known: true, kind: "wounded", label: "Ранен"},
		{name: "critical", current: 25, maximum: 100, known: true, kind: "critical", label: "Критически ранен"},
		{name: "player down", current: 0, maximum: 100, known: true, kind: "down", label: "Без сознания"},
		{name: "npc down", current: 0, maximum: 100, known: true, npc: true, kind: "down", label: "Повержен"},
		{name: "unknown", current: 0, maximum: 0, known: false, kind: "unknown", label: "Состояние неизвестно"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got := encounterHealth(test.current, test.maximum, test.known, test.npc, false)
			if got.Kind != test.kind || got.Label != test.label {
				t.Fatalf("want %s/%s, got %s/%s", test.kind, test.label, got.Kind, got.Label)
			}
		})
	}
}

func TestBuildPublicCombatantIncludesNPCItemCover(t *testing.T) {
	coverURL := "https://cdn.example.test/creature-cover.webp"
	itemID := int64(42)

	combatant := buildPublicCombatant(rawPublicCombatant{
		UID:      "npc-1",
		Type:     "npc",
		ItemID:   &itemID,
		Override: map[string]any{},
	}, store.SessionParticipantData{}, map[int64]store.Item{
		itemID: {Name: "Совомедведь", CoverImageURL: &coverURL},
	}, nil, 1, false)

	if combatant.CoverImageURL == nil || *combatant.CoverImageURL != coverURL {
		t.Fatalf("cover image URL = %v, want %q", combatant.CoverImageURL, coverURL)
	}
}

func TestEncounterHealthIncludesNumbersOnlyWhenEnabled(t *testing.T) {
	hidden := encounterHealth(7, 12, true, true, false)
	if hidden.Current != nil || hidden.Maximum != nil {
		t.Fatal("hidden health must not expose numeric values")
	}
	shown := encounterHealth(7, 12, true, true, true)
	if shown.Current == nil || *shown.Current != 7 || shown.Maximum == nil || *shown.Maximum != 12 {
		t.Fatalf("numeric health = %v/%v, want 7/12", shown.Current, shown.Maximum)
	}
}
