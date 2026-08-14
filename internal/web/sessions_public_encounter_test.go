package web

import "testing"

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
			got := encounterHealth(test.current, test.maximum, test.known, test.npc)
			if got.Kind != test.kind || got.Label != test.label {
				t.Fatalf("want %s/%s, got %s/%s", test.kind, test.label, got.Kind, got.Label)
			}
		})
	}
}
