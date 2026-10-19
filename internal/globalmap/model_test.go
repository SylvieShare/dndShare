package globalmap

import (
	"encoding/json"
	"math"
	"strings"
	"testing"
)

func TestRouteValidation(t *testing.T) {
	valid := func() []Route {
		return []Route{{ID: "route", Name: "Путь", Color: "#d4ae69", PlayerIDs: []int64{10, 20}, Points: []Point{{ID: "a", X: 0, Y: 1, Note: "Привал"}, {ID: "b", X: .5, Y: .5}}}}
	}
	if err := Validate("Мир", valid()); err != nil {
		t.Fatal(err)
	}
	for _, modify := range []func([]Route){
		func(r []Route) { r[0].Points[0].X = math.NaN() },
		func(r []Route) { r[0].Points[0].Y = 1.01 },
		func(r []Route) { r[0].Points[0].ID = "b" },
		func(r []Route) { r[0].Color = "url(javascript:bad)" },
		func(r []Route) { r[0].PlayerIDs = []int64{10, 10} },
		func(r []Route) { r[0].Points[0].Note = strings.Repeat("я", 2001) },
	} {
		r := valid()
		modify(r)
		if Validate("Мир", r) == nil {
			t.Fatal("invalid route accepted", r)
		}
	}
	if Validate("", valid()) == nil {
		t.Fatal("blank name accepted")
	}
}

func TestPruneDetachedLinksKeepsPointsAndNotes(t *testing.T) {
	chapter, removed := int64(1), int64(2)
	routes := []Route{{PlayerIDs: []int64{10, 20}, Points: []Point{{ID: "one", Note: "Заметка", ChapterID: &chapter}, {ID: "two", ChapterID: &removed}}}}
	PruneReferences(routes, map[int64]bool{10: true}, map[int64]bool{1: true}, nil)
	if len(routes[0].PlayerIDs) != 1 || routes[0].PlayerIDs[0] != 10 || routes[0].Points[0].ChapterID == nil || routes[0].Points[1].ChapterID != nil || routes[0].Points[0].Note != "Заметка" {
		t.Fatal(routes)
	}
}

func TestSharedPointReferencesAndBends(t *testing.T) {
	valid := func() []Route {
		return []Route{{ID: "route", Name: "Путь", Color: "#ffffff", Points: []Point{
			{ID: "a", X: .1, Y: .2, Name: "Начало"}, {ID: "bend", X: .2, Y: .3, Control: true}, {ID: "b", X: .5, Y: .6}, {ID: "return", RefID: "a"},
		}}, {ID: "other", Name: "Другой путь", Color: "#000000", Points: []Point{{ID: "shared", RefID: "a"}}}}
	}
	if err := Validate("Мир", valid()); err != nil {
		t.Fatal(err)
	}
	for _, modify := range []func([]Route){
		func(r []Route) { r[0].Points[3].RefID = "missing" },
		func(r []Route) { r[0].Points[3].RefID = "return" },
		func(r []Route) { r[0].Points[3].RefID = "shared" },
		func(r []Route) { r[0].Points[3].RefID = "bend" },
		func(r []Route) { r[0].Points[3].X = .4 },
		func(r []Route) { r[0].Points[3].Name = "Copied metadata" },
		func(r []Route) { r[0].Points[1].Note = "No details for a bend" },
		func(r []Route) { r[0].Points[0].Control = true; r[0].Points[0].Name = "" },
	} {
		routes := valid()
		modify(routes)
		if Validate("Мир", routes) == nil {
			t.Fatal("invalid reference or bend accepted", routes)
		}
	}
}

func TestRoutePointJSONRoundTrip(t *testing.T) {
	routes := []Route{{ID: "route", Name: "Путь", Color: "#ffffff", Points: []Point{{ID: "a", X: .2, Y: .3, Note: "Shared"}, {ID: "bend", X: .4, Y: .5, Control: true}, {ID: "again", RefID: "a"}}}}
	raw, err := json.Marshal(routes)
	if err != nil {
		t.Fatal(err)
	}
	var decoded []Route
	if err = json.Unmarshal(raw, &decoded); err != nil {
		t.Fatal(err)
	}
	if err = Validate("Мир", decoded); err != nil {
		t.Fatal(err)
	}
	if !decoded[0].Points[1].Control || decoded[0].Points[2].RefID != "a" || decoded[0].Points[0].Note != "Shared" {
		t.Fatal(decoded)
	}
}
