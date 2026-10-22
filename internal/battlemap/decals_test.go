package battlemap

import (
	"encoding/json"
	"testing"
)

func TestDecalDocumentValidation(t *testing.T) {
	base := Document{Version: DocumentVersion, Kind: "tiles", Width: 10, Height: 10, Tiles: []Tile{{ID: "tile", ModelID: "00000000-0000-4000-8000-000000000001"}}}
	decal := Decal{ID: "stain", Name: "Кровь", Category: "traces", ImageURL: "/images/maps/decals/blood-pool.svg", Anchor: LightAnchor{Kind: "tile", ID: "tile"}, Normal: [3]float64{0, 1, 0}, Width: 1, Height: 1, Depth: .1, Opacity: 1, Color: "#ffffff"}
	base.Decals = []Decal{decal}
	if err := ValidateDocument(&base); err != nil {
		t.Fatal(err)
	}
	for _, change := range []func(*Decal){
		func(d *Decal) { d.Anchor.ID = "missing" }, func(d *Decal) { d.Anchor.Kind = "unknown" },
		func(d *Decal) { d.ImageURL = "https://example.com/untrusted.svg" }, func(d *Decal) { d.ImageURL = "/images/maps/decals/../../evil.svg" },
		func(d *Decal) { d.Normal = [3]float64{} }, func(d *Decal) { d.Width = 0 }, func(d *Decal) { d.Opacity = 2 }, func(d *Decal) { d.Category = "other" },
	} {
		copy := base
		copy.Decals = []Decal{decal}
		change(&copy.Decals[0])
		if ValidateDocument(&copy) == nil {
			t.Fatalf("accepted invalid decal: %+v", copy.Decals[0])
		}
	}
	base.Decals = append(base.Decals, decal)
	if ValidateDocument(&base) == nil {
		t.Fatal("accepted duplicate IDs")
	}
}
func TestAbsentDecalsStayAbsent(t *testing.T) {
	d := Document{Version: DocumentVersion, Kind: "tiles", Width: 10, Height: 10}
	if err := ValidateDocument(&d); err != nil {
		t.Fatal(err)
	}
	raw, _ := json.Marshal(d)
	var fields map[string]json.RawMessage
	json.Unmarshal(raw, &fields)
	if _, ok := fields["decals"]; ok {
		t.Fatal("loading an unchanged map must not add empty decals")
	}
}
