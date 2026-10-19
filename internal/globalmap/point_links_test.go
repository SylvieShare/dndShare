package globalmap

import (
	"encoding/json"
	"reflect"
	"testing"
)

func TestMultiplePointLinks(t *testing.T) {
	first := int64(11)
	point := Point{ID: "point", X: .2, Y: .3, ChapterID: &first, AdditionalChapterIDs: []int64{12, 13}, LocationIDs: []int64{21, 22}}
	routes := []Route{{ID: "route", Name: "Путь", Color: "#ffffff", Points: []Point{point}}}
	if err := Validate("Мир", routes); err != nil {
		t.Fatal(err)
	}
	raw, err := json.Marshal(routes)
	if err != nil {
		t.Fatal(err)
	}
	var decoded []Route
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(decoded, routes) {
		t.Fatal("links did not round trip", decoded)
	}
	PruneReferences(decoded, nil, map[int64]bool{12: true, 13: true}, map[int64]bool{22: true})
	p := decoded[0].Points[0]
	if !reflect.DeepEqual(p.ChapterIDs(), []int64{12, 13}) || !reflect.DeepEqual(p.LocationIDs, []int64{22}) {
		t.Fatal(p)
	}
	PruneReferences(decoded, nil, nil, nil)
	if hasLinks(decoded[0].Points[0]) {
		t.Fatal(decoded)
	}
}

func TestRejectInvalidPointLinks(t *testing.T) {
	first := int64(11)
	for _, point := range []Point{
		{ChapterID: &first, AdditionalChapterIDs: []int64{11}},
		{AdditionalChapterIDs: []int64{12}},
		{LocationIDs: []int64{21, 21}},
		{LocationIDs: []int64{0}},
		{ChapterID: &first, AdditionalChapterIDs: []int64{-1}},
		{RefID: "a", LocationIDs: []int64{21}},
		{Control: true, LocationIDs: []int64{21}},
		{Control: true, ChapterID: &first},
	} {
		point.ID = "b"
		routes := []Route{{ID: "route", Name: "Путь", Color: "#ffffff", Points: []Point{{ID: "a"}, point, {ID: "c"}}}}
		if Validate("Мир", routes) == nil {
			t.Fatal("invalid point links accepted", point)
		}
	}
}
