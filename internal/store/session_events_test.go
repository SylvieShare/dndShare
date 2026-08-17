package store

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestCharacterName(t *testing.T) {
	tests := []struct {
		name string
		data string
		want string
	}{
		{name: "dnd", data: `{"values":{"name":" Лиора "}}`, want: "Лиора"},
		{name: "generic", data: `{"values":{"char_name":"Виктор"}}`, want: "Виктор"},
		{name: "unnamed", data: `{}`, want: "(без имени)"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := characterName(json.RawMessage(test.data)); got != test.want {
				t.Fatalf("characterName() = %q, want %q", got, test.want)
			}
		})
	}
}

func TestCharacterNameLimitsSnapshotLength(t *testing.T) {
	name := strings.Repeat("Я", 170)
	data, err := json.Marshal(map[string]any{"values": map[string]any{"name": name}})
	if err != nil {
		t.Fatal(err)
	}
	if got := []rune(characterName(data)); len(got) != 160 {
		t.Fatalf("characterName rune length = %d, want 160", len(got))
	}
}
