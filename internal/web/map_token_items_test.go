package web

import (
	"dndshare/internal/battlemap"
	"testing"
)

func TestEncounterMapTokensLifeStateIsReadOnly(t *testing.T) {
	state := battlemap.State{Tokens: []battlemap.Token{
		{ID: "npc", Kind: "creature", Ref: "ogre", ItemID: 12},
		{ID: "player", Kind: "player", Ref: "41"},
		{ID: "unknown", Kind: "creature", Ref: "missing", Dead: true},
	}}
	combatants := []mapCombatant{{UID: "ogre", Type: "npc", ItemID: 12, Position: "dead"}, {Type: "player", CharID: 41, Position: "combat"}}
	result := encounterMapTokens(state, combatants)
	if !result.Tokens[0].Dead || result.Tokens[1].Dead || result.Tokens[2].Dead {
		t.Fatalf("incorrect death projection: %+v", result.Tokens)
	}
	if state.Tokens[0].Dead {
		t.Fatal("mutated saved map")
	}
	combatants[0].Position = "reserve"
	if encounterMapTokens(state, combatants).Tokens[0].Dead {
		t.Fatal("revival did not clear death marker")
	}
	state.Tokens[0].ItemID = 0
	if encounterMapTokens(state, combatants).Tokens[0].ItemID != 12 || state.Tokens[0].ItemID != 0 {
		t.Fatal("item projection mutated saved placement")
	}
}
