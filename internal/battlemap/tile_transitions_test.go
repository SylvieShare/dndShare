package battlemap

import (
	"encoding/json"
	"reflect"
	"testing"
)

func TestTileTransitionsSurviveDocumentRoundTrip(t *testing.T) {
	d := testPresets()[0].Document
	a, b := d.Tiles[0].ModelID, "00000000-0000-4000-8000-000000000001"
	d.Tiles[0].Transitions = &TileTransitions{OriginalModelID: a, Targets: []TileTransition{{ID: "draft"}, {ID: "chosen", ModelID: b}}}
	if err := ValidateDocument(&d); err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(d)
	if err != nil {
		t.Fatal(err)
	}
	var loaded Document
	if err := json.Unmarshal(data, &loaded); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(loaded.Tiles[0].Transitions, d.Tiles[0].Transitions) {
		t.Fatal("lost instance transitions")
	}
	if !reflect.DeepEqual(TileModelReferences(loaded.Tiles[0]), []string{a, a, b}) {
		t.Fatal("lost unplaced target references")
	}
	for _, bad := range []*TileTransitions{
		{OriginalModelID: "bad"},
		{OriginalModelID: a, Targets: []TileTransition{{ID: "same"}, {ID: "same"}}},
		{OriginalModelID: a, Targets: []TileTransition{{ID: "one", ModelID: b}, {ID: "two", ModelID: b}}},
		{OriginalModelID: a, Targets: []TileTransition{{ID: "one", ModelID: "bad"}}},
		{OriginalModelID: a, Targets: make([]TileTransition, MaxTileTransitions+1)},
	} {
		d.Tiles[0].Transitions = bad
		if ValidateDocument(&d) == nil {
			t.Fatal("accepted invalid transitions", bad)
		}
	}
}

func TestTransitionModelsMustExistAndBeTiles(t *testing.T) {
	empty := &TileTransitions{OriginalModelID: "99000000-0000-4000-8000-000000000001"}
	if err := validateTileTransitions(empty); err != nil || empty.Targets == nil {
		t.Fatal("targets must serialize as an array", err)
	}
	d := Document{Tiles: []Tile{{ModelID: "a", Transitions: &TileTransitions{OriginalModelID: "a", Targets: []TileTransition{{ID: "custom", ModelID: "b"}}}}}}
	models := map[string]ModelMetadata{"a": {TileType: "floor"}}
	if validateTransitionModels(d, models) == nil {
		t.Fatal("accepted unknown target")
	}
	models["b"] = ModelMetadata{TileType: "object"}
	if validateTransitionModels(d, models) == nil {
		t.Fatal("accepted object target")
	}
	models["b"] = ModelMetadata{TileType: "stairs"}
	if err := validateTransitionModels(d, models); err != nil {
		t.Fatal(err)
	}
}
