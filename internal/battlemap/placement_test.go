package battlemap

import "testing"

func TestUpperTilesRequireRotatedCoplanarSlots(t *testing.T) {
	models := map[string]ModelMetadata{
		"frame": {Width: 2, Height: 1, SupportSlots: []SupportSlot{{X: 0, Y: 0, Width: 2, Height: 1, Elevation: .7}}},
		"floor": {Width: 1, Height: 1}, "wide": {Width: 2, Height: 1},
	}
	base := Tile{ID: "base", ModelID: "frame", X: 1, Y: 1, Level: 0}
	upper := Tile{ID: "upper", ModelID: "floor", X: 1, Y: 1, Level: 1}
	d := Document{Width: 8, Height: 8, Tiles: []Tile{upper}}
	if _, err := ResolveTilePlacements(d, models); err == nil {
		t.Fatal("accepted floating tile")
	}
	d.Tiles = []Tile{upper, base}
	placements, err := ResolveTilePlacements(d, models)
	if err != nil || placements["upper"].Elevation != .7 {
		t.Fatalf("socket not resolved: %#v %v", placements, err)
	}
	d.Tiles[0].ModelID = "wide"
	d.Tiles[0].X = 2
	if _, err := ResolveTilePlacements(d, models); err == nil {
		t.Fatal("accepted unsupported half footprint")
	}
	d.Tiles = []Tile{{ID: "base", ModelID: "frame", X: 1, Y: 1, Rotation: 90}, {ID: "upper", ModelID: "floor", X: 1, Y: 2, Level: 1}}
	if _, err := ResolveTilePlacements(d, models); err != nil {
		t.Fatal(err)
	}
}
