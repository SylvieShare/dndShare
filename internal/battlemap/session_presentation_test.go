package battlemap

import (
	"encoding/json"
	"testing"
)

func TestPlayStateDoesNotDuplicateScenePresentation(t *testing.T) {
	raw, err := json.Marshal(InitialState())
	if err != nil {
		t.Fatal(err)
	}
	var fields map[string]any
	json.Unmarshal(raw, &fields)
	for _, key := range []string{"areas", "lighting"} {
		if _, exists := fields[key]; exists {
			t.Fatal("scene field in play state", key)
		}
	}
}
func TestPublicTokensUseEditedSceneAreas(t *testing.T) {
	d := Document{Areas: []Area{{ID: "room", Hidden: true, TileIDs: []string{"floor"}}}}
	s := InitialState()
	s.Fog = false
	s.Tokens = []Token{{ID: "hero", Ref: "private", Placement: &PlacementAnchor{TileID: "floor"}}}
	if len(PublicState(d, s).Tokens) != 0 {
		t.Fatal("hidden area leaked")
	}
	d.Areas[0].Hidden = false
	public := PublicState(d, s)
	if len(public.Tokens) != 1 || public.Tokens[0].Ref != "" {
		t.Fatal("revealed token missing or private reference leaked")
	}
}
