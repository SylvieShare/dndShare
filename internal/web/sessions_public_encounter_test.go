package web

import (
	"encoding/json"
	"strings"
	"testing"

	"dndshare/internal/store"
)

func TestEncounterHealthUsesPublicWordedBands(t *testing.T) {
	tests := []struct {
		name    string
		current float64
		maximum float64
		known   bool
		kind    string
		label   string
	}{
		{name: "healthy", current: 51, maximum: 100, known: true, kind: "healthy", label: "Здоров"},
		{name: "wounded", current: 50, maximum: 100, known: true, kind: "wounded", label: "Ранен"},
		{name: "critical", current: 25, maximum: 100, known: true, kind: "critical", label: "При смерти"},
		{name: "player down", current: 0, maximum: 100, known: true, kind: "down", label: "При смерти"},
		{name: "npc down", current: 0, maximum: 100, known: true, kind: "down", label: "При смерти"},
		{name: "unknown", current: 0, maximum: 0, known: false, kind: "unknown", label: "Неизвестно"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got := encounterHealth(test.current, test.maximum, test.known, false)
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

func TestBuildPublicCombatantSeparatesPlayerIconAndPortrait(t *testing.T) {
	iconURL := "https://cdn.example.test/icon.webp"
	portraitURL := "https://cdn.example.test/portrait.webp"
	participant := store.SessionParticipantData{
		IconImageURL: &iconURL,
		Data: map[string]any{"values": map[string]any{
			"ava": map[string]any{"url": portraitURL},
		}},
	}

	combatant := buildPublicCombatant(rawPublicCombatant{
		UID: "player-1", Type: "player",
	}, participant, nil, nil, 1, false)
	if combatant.IconImageURL == nil || *combatant.IconImageURL != iconURL {
		t.Fatalf("player icon = %v, want %q", combatant.IconImageURL, iconURL)
	}
	if combatant.AvatarURL == nil || *combatant.AvatarURL != portraitURL {
		t.Fatalf("player portrait = %v, want %q", combatant.AvatarURL, portraitURL)
	}
}

func TestBuildPublicCombatantIncludesStatePresentation(t *testing.T) {
	stateID := int64(7)
	color := "#e66a52"
	svg := `<svg viewBox="0 0 24 24"><path d="M12 2v20"/></svg>`

	combatant := buildPublicCombatant(rawPublicCombatant{
		UID:      "npc-1",
		Type:     "npc",
		States:   []int64{stateID},
		Override: map[string]any{"name": "Гоблин"},
	}, store.SessionParticipantData{}, nil, map[int64]publicEncounterState{
		stateID: {Name: "Оглушён", Color: &color, SVG: &svg},
	}, 1, false)

	if len(combatant.States) != 1 {
		t.Fatalf("states = %d, want 1", len(combatant.States))
	}
	state := combatant.States[0]
	if state.Name != "Оглушён" || state.Color == nil || *state.Color != color || state.SVG == nil || *state.SVG != svg {
		t.Fatalf("state presentation = %#v", state)
	}
}

func TestEncounterHealthIncludesNumbersOnlyWhenEnabled(t *testing.T) {
	hidden := encounterHealth(7, 12, true, false)
	if hidden.Current != nil || hidden.Maximum != nil {
		t.Fatal("hidden health must not expose numeric values")
	}
	shown := encounterHealth(7, 12, true, true)
	if shown.Current == nil || *shown.Current != 7 || shown.Maximum == nil || *shown.Maximum != 12 {
		t.Fatalf("numeric health = %v/%v, want 7/12", shown.Current, shown.Maximum)
	}
}

func TestPublicEncounterCombatantOmitsInitiative(t *testing.T) {
	initiative := 17
	payload, err := json.Marshal(publicEncounterCombatant{UID: "npc-1", Initiative: &initiative})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(payload), "initiative") {
		t.Fatalf("public combatant must not expose initiative: %s", payload)
	}
}
