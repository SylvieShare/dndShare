package web

import (
	"encoding/json"
	"testing"

	"dndshare/internal/store"
)

func TestPublicPlayerHealthFromStructuredMaximum(t *testing.T) {
	for _, test := range []struct {
		name, hp, kind   string
		current, maximum float64
	}{
		{"bonuses", `{"current":12,"max":{"base":20,"bonuses":[{"value":8},{"value":-4}]}}`, "wounded", 12, 24},
		{"down", `{"current":0,"max":{"base":20}}`, "down", 0, 20},
		{"numeric strings", `{"current":"12","max":{"base":"20","bonuses":[{"value":"4"}]}}`, "wounded", 12, 24},
		{"integer bonuses", `{"current":12,"max":{"base":20.9,"bonuses":[{"value":4.8}]}}`, "wounded", 12, 24},
		{"clamped maximum", `{"current":12,"max":{"base":20,"bonuses":[{"value":-40}]}}`, "unknown", 12, 0},
		{"missing", `{}`, "unknown", 0, 0},
	} {
		t.Run(test.name, func(t *testing.T) {
			var hp map[string]any
			if err := json.Unmarshal([]byte(test.hp), &hp); err != nil {
				t.Fatal(err)
			}
			participant := store.SessionParticipantData{TemplateName: "DND5", Data: map[string]any{
				"values": map[string]any{"hp": hp},
			}}
			for _, numbers := range []bool{false, true} {
				combatant := buildPublicCombatant(rawPublicCombatant{UID: "player", Type: "player"}, participant, nil, nil, 1, numbers)
				health := combatant.Health
				if health.Kind != test.kind {
					t.Fatalf("health = %#v, want %s", health, test.kind)
				}
				if numbers && test.maximum > 0 {
					if health.Current == nil || health.Maximum == nil || *health.Current != test.current || *health.Maximum != test.maximum {
						t.Fatalf("numeric health = %#v", health)
					}
				} else if health.Current != nil || health.Maximum != nil {
					t.Fatal("unexpected public HP numbers")
				}
			}
		})
	}
}
