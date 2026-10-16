package globalmap

import (
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
	PruneReferences(routes, map[int64]bool{10: true}, map[int64]bool{1: true})
	if len(routes[0].PlayerIDs) != 1 || routes[0].PlayerIDs[0] != 10 || routes[0].Points[0].ChapterID == nil || routes[0].Points[1].ChapterID != nil || routes[0].Points[0].Note != "Заметка" {
		t.Fatal(routes)
	}
}
