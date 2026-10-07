package battlemap

import (
	"encoding/json"
	"testing"
)

func TestSessionPresentationValidation(t *testing.T) {
	d := Document{
		Areas:  []Area{{ID: "room"}},
		Lights: []Light{{ID: "torch", Enabled: true, Shadows: true}, {ID: "candle", Shadows: true}, {ID: "magic", Shadows: true}},
	}
	s := InitialState()
	s.Areas = map[string]bool{"room": false}
	s.Lighting = &SessionLighting{Enabled: true, Sun: *DefaultSun(), Lights: map[string]bool{"torch": false}}
	raw, err := json.Marshal(s)
	if err != nil {
		t.Fatal(err)
	}
	var saved State
	if err := json.Unmarshal(raw, &saved); err != nil {
		t.Fatal(err)
	}
	if err := ValidateState(&saved, d); err != nil {
		t.Fatal(err)
	}
	if saved.Areas["room"] || saved.Lighting.Lights["torch"] {
		t.Fatal("explicit disabled presentation was not preserved")
	}
	for _, mutate := range []func(*State){
		func(s *State) { s.Areas["unknown"] = true },
		func(s *State) { s.Lighting.Lights["unknown"] = true },
		func(s *State) { s.Lighting.Sun.Elevation = 0 },
		func(s *State) { s.Lighting.Sun.Angle = 361 },
		func(s *State) { s.Lighting.Lights = map[string]bool{"torch": true, "candle": true, "magic": true} },
	} {
		var invalid State
		if err := json.Unmarshal(raw, &invalid); err != nil {
			t.Fatal(err)
		}
		mutate(&invalid)
		if ValidateState(&invalid, d) == nil {
			t.Fatal("invalid presentation accepted")
		}
	}
}

func TestPublicTokenVisibilityUsesSessionAreas(t *testing.T) {
	d := Document{Areas: []Area{{ID: "room", Hidden: true, TileIDs: []string{"floor"}}}}
	s := InitialState()
	s.Fog = false
	s.Tokens = []Token{{ID: "hero", Ref: "internal", Placement: &PlacementAnchor{TileID: "floor"}}}
	if len(PublicState(d, s).Tokens) != 0 {
		t.Fatal("token on hidden area exposed")
	}
	s.Areas = map[string]bool{"room": true}
	public := PublicState(d, s)
	if len(public.Tokens) != 1 || public.Tokens[0].Ref != "" {
		t.Fatal("revealed area's public token missing or contains private link")
	}
	s.Areas["room"] = false
	if len(PublicState(d, s).Tokens) != 0 {
		t.Fatal("session area toggle ignored")
	}
}
