package store

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestItemAutomationPatch(t *testing.T) {
	for _, status := range []string{"unreviewed", "full", "partial", "none", "not_applicable"} {
		p := ItemAutomationPatch{AutomationStatus: &status}
		if err := p.Validate(); err != nil {
			t.Fatal(err)
		}
		if p.Initial().AutomationStatus != status {
			t.Fatal("status lost")
		}
	}
	for _, status := range []string{"", "unknown", "FULL", "requires_player_interaction"} {
		p := ItemAutomationPatch{AutomationStatus: &status}
		if p.Validate() == nil {
			t.Fatalf("accepted %q", status)
		}
	}
	p := ItemAutomationPatch{}
	if p.Initial().AutomationStatus != "unreviewed" {
		t.Fatal("default must not claim coverage")
	}
	note := "  " + strings.Repeat("я", 1000) + "  "
	p.AutomationNote = &note
	if err := p.Validate(); err != nil {
		t.Fatal(err)
	}
	note = strings.Repeat("я", 1001)
	p.AutomationNote = &note
	if p.Validate() == nil {
		t.Fatal("accepted long note")
	}
	var payload ItemAutomationPatch
	if err := json.Unmarshal([]byte(`{"requiresPlayerInteraction":false,"automationNote":""}`), &payload); err != nil {
		t.Fatal(err)
	}
	if payload.AutomationStatus != nil || payload.RequiresPlayerInteraction == nil || *payload.RequiresPlayerInteraction || payload.AutomationNote == nil || *payload.AutomationNote != "" {
		t.Fatal("omission and explicit clear must differ")
	}
}
