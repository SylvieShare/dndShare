package store

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestRPSOutcomesAndSecrecy(t *testing.T) {
	choices := []string{"rock", "scissors", "paper"}
	expected := [][]int{{0, 1, 2}, {2, 0, 1}, {1, 2, 0}}
	for i, sender := range choices {
		for j, recipient := range choices {
			if got := rpsWinner(sender, recipient); got != expected[i][j] {
				t.Fatalf("%s vs %s = %d", sender, recipient, got)
			}
		}
	}
	data, _ := json.Marshal(InteractionData{Status: "pending"})
	if strings.Contains(string(data), "Choice") || strings.Contains(string(data), "winner") {
		t.Fatalf("pending choice leaked: %s", data)
	}
}
func TestValidInteraction(t *testing.T) {
	for _, c := range []struct {
		kind, message, choice string
		valid                 bool
	}{
		{"chat_message", "hello", "", true}, {"chat_message", strings.Repeat("я", 2000), "", true},
		{"chat_message", strings.Repeat("я", 2001), "", false}, {"chat_message", " \n ", "", false},
		{"chat_message", "hello", "rock", false}, {"rps_challenge", "", "rock", true},
		{"rps_challenge", "hello", "rock", false}, {"rps_challenge", "", "lizard", false}, {"dice_roll", "", "rock", false},
	} {
		if ValidInteraction(c.kind, c.message, c.choice) != c.valid {
			t.Fatalf("validation: %+v", c)
		}
	}
}
