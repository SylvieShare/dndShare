package battlemap

import (
	"encoding/json"
	"testing"
)

func TestCreatureBaseAssignmentsAndPublicPose(t *testing.T) {
	state := InitialState()
	state.Fog = false
	state.UseCreatureBases = true
	state.Tokens = []Token{{ID: "kobold", Kind: "creature", Ref: "private", Size: 2, BaseModelID: "large", Rotation: 270, Mirrored: true}}
	if err := ValidateCreatureBaseAssignments(state, map[string]float64{"large": 2}); err != nil {
		t.Fatal(err)
	}
	encoded, err := json.Marshal(state)
	if err != nil {
		t.Fatal(err)
	}
	var saved State
	if err := json.Unmarshal(encoded, &saved); err != nil {
		t.Fatal(err)
	}
	public := PublicState(Document{}, saved)
	if !public.UseCreatureBases || len(public.Tokens) != 1 || public.Tokens[0].BaseModelID != "large" || public.Tokens[0].Rotation != 270 || !public.Tokens[0].Mirrored || public.Tokens[0].Ref != "" {
		t.Fatalf("lost public pose: %+v", public)
	}
	for _, hidden := range []bool{false, true} {
		state.UseCreatureBases = hidden
		if ValidateCreatureBaseAssignments(state, map[string]float64{"large": 1}) == nil {
			t.Fatal("accepted mismatched base, including disabled assignment")
		}
		if ValidateCreatureBaseAssignments(state, nil) == nil {
			t.Fatal("accepted unregistered base")
		}
	}
	state.Tokens[0].Kind = "player"
	if ValidateCreatureBaseAssignments(state, map[string]float64{"large": 2}) == nil {
		t.Fatal("accepted player base")
	}
	state.Tokens[0].Hidden = true
	if len(PublicState(Document{}, state).Tokens) != 0 {
		t.Fatal("leaked a hidden creature's base")
	}
}

func TestTokenPoseStateValidation(t *testing.T) {
	d := testPresets()[0].Document
	state := InitialState()
	state.Tokens = []Token{{ID: "kobold", Kind: "creature", Name: "Кобольд", Color: "#c18f6f", Size: 1, X: 1, Y: 1, Rotation: 90, Mirrored: true, BaseModelID: "11111111-1111-4111-8111-111111111111"}}
	if err := ValidateState(&state, d); err != nil {
		t.Fatal(err)
	}
	for _, angle := range []int{-90, 45, 360} {
		state.Tokens[0].Rotation = angle
		if ValidateState(&state, d) == nil {
			t.Fatalf("accepted rotation %d", angle)
		}
	}
	state.Tokens[0].Rotation = 0
	state.Tokens[0].Kind = "player"
	if ValidateState(&state, d) == nil {
		t.Fatal("accepted a base on a player")
	}
}

func TestMapWritesDoNotPersistEncounterDeath(t *testing.T) {
	d := testPresets()[0].Document
	state := InitialState()
	state.Tokens = []Token{{ID: "dead", Kind: "creature", Name: "Огр", Color: "#c18f6f", Size: 1, X: 1, Y: 1, Dead: true}}
	if err := ValidateState(&state, d); err != nil {
		t.Fatal(err)
	}
	if state.Tokens[0].Dead {
		t.Fatal("persisted a derived encounter field")
	}
}
