package web

import (
	"encoding/json"
	"testing"
)

func TestEncounterReserveMetadataValidation(t *testing.T) {
	for _, raw := range []string{
		`{"combatants":[]}`,
		`{"reserveTabs":[],"combatants":[{"type":"npc"}]}`,
		`{"reserveTabs":[{"id":"wolves","name":"Волки"}],"combatants":[{"type":"npc","reserveTabId":"wolves"}]}`,
		`{"reserveTabs":[],"combatants":[{"type":"npc","reserveTabId":"removed-tab"}]}`,
	} {
		if err := validateEncounterReserves(json.RawMessage(raw)); err != nil {
			t.Fatalf("valid metadata %s: %v", raw, err)
		}
	}
	for _, raw := range []string{
		`{"reserveTabs":[{"id":"default","name":"Rename default"}],"combatants":[]}`,
		`{"reserveTabs":[{"id":"a","name":"A"},{"id":"a","name":"B"}],"combatants":[]}`,
		`{"reserveTabs":[{"id":"a","name":"  "}],"combatants":[]}`,
		`{"reserveTabs":{},"combatants":[]}`,
		`{"combatants":[{"type":"player","reserveTabId":"a"}]}`,
		`{"combatants":[{"type":"npc","reserveTabId":12}]}`,
	} {
		if err := validateEncounterReserves(json.RawMessage(raw)); err == nil {
			t.Fatalf("accepted invalid metadata %s", raw)
		}
	}
}
