package battlemap

import "testing"

func TestUpperTilesAllowRotatedPartialSupports(t *testing.T) {
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
	if _, err := ResolveTilePlacements(d, models); err != nil {
		t.Fatalf("rejected one-cell supported overhang: %v", err)
	}
	d.Tiles[0].X = 3
	if _, err := ResolveTilePlacements(d, models); err == nil {
		t.Fatal("accepted overhang with no support")
	}
	d.Tiles = []Tile{{ID: "base", ModelID: "frame", X: 1, Y: 1, Rotation: 90}, {ID: "upper", ModelID: "floor", X: 1, Y: 2, Level: 1}}
	if _, err := ResolveTilePlacements(d, models); err != nil {
		t.Fatal(err)
	}
}

func TestBridgeUsesHighestSupportingCellsAndKeepsCollisionChecks(t *testing.T) {
	models := map[string]ModelMetadata{
		"low":    {Width: 1, Height: 1, SupportSlots: []SupportSlot{{Width: 1, Height: 1, Elevation: .5}}},
		"high":   {Width: 1, Height: 1, SupportSlots: []SupportSlot{{Width: 1, Height: 1, Elevation: .9}}},
		"bridge": {Width: 3, Height: 1},
	}
	d := Document{Width: 8, Height: 8, Tiles: []Tile{
		{ID: "left", ModelID: "low", X: 1, Y: 1},
		{ID: "right", ModelID: "high", X: 3, Y: 1},
		{ID: "bridge", ModelID: "bridge", X: 1, Y: 1, Level: 1},
	}}
	placements, err := ResolveTilePlacements(d, models)
	if err != nil || placements["bridge"].Elevation != .9 || len(placements["bridge"].Supports) != 1 || placements["bridge"].Supports[0] != "right" {
		t.Fatalf("bridge support: %+v %v", placements, err)
	}
	d.Tiles = append(d.Tiles, Tile{ID: "overlap", ModelID: "bridge", X: 2, Y: 1, Level: 1})
	if _, err := ResolveTilePlacements(d, models); err == nil {
		t.Fatal("accepted overlapping bridges")
	}
}
