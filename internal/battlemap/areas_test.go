package battlemap

import (
	"encoding/json"
	"testing"
)

func TestMapAreasReferenceExistingModelsOnce(t *testing.T) {
	d := Presets()[0].Document
	d.Objects = []Object{{ID: "chest", Kind: "chest", X: 3, Y: 3, Scale: 1}}
	d.Areas = []Area{{ID: "hall", Name: "Зал", Hidden: true, TileIDs: []string{d.Tiles[0].ID}, ObjectIDs: []string{"chest"}}}
	if err := ValidateDocument(&d); err != nil {
		t.Fatal(err)
	}
	for _, change := range []func(*Document){
		func(d *Document) { d.Areas[0].TileIDs = []string{"missing"} },
		func(d *Document) { d.Areas[0].ObjectIDs = []string{"missing"} },
		func(d *Document) { d.Areas[0].Name = " " },
		func(d *Document) { d.Areas[0].Color = "red" },
		func(d *Document) { d.Areas[0].Color = "#12345g" },
		func(d *Document) { d.Areas = append(d.Areas, d.Areas[0]) },
		func(d *Document) {
			d.Areas = append(d.Areas, Area{ID: "second", Name: "Другой зал", TileIDs: []string{d.Tiles[0].ID}})
		},
	} {
		copy := d
		copy.Areas = append([]Area(nil), d.Areas...)
		change(&copy)
		if ValidateDocument(&copy) == nil {
			t.Fatal("invalid area accepted")
		}
	}
}

func TestAreaColorsDefaultAndSurviveRoundTrip(t *testing.T) {
	d := Presets()[0].Document
	d.Areas = []Area{{ID: "empty", Name: "Пустая"}, {ID: "custom", Name: "Зал", Color: "#22c55e"}}
	if err := ValidateDocument(&d); err != nil {
		t.Fatal(err)
	}
	raw, err := json.Marshal(d)
	if err != nil {
		t.Fatal(err)
	}
	var roundTrip Document
	if err = json.Unmarshal(raw, &roundTrip); err != nil {
		t.Fatal(err)
	}
	if roundTrip.Areas[0].Color != DefaultAreaColor || roundTrip.Areas[1].Color != "#22c55e" {
		t.Fatalf("colors lost: %+v", roundTrip.Areas)
	}
}
