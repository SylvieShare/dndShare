package battlemap

import "testing"

func TestSharedSurfaceAnchors(t *testing.T) {
	model := ModelMetadata{Width: 3, Height: 1, MountDepth: .2, CanStand: true, PlacementPoints: []PlacementPoint{{X: .5, Y: .5, Elevation: .8}}}
	tile := Tile{ID: "parent", ModelID: "floor", X: 2, Y: 3, Rotation: 90}
	x, y, z := SurfacePosition(tile, model, model.PlacementPoints[0], 1)
	if x != 2.5 || y != 3.5 || z != 1.6 {
		t.Fatalf("incorrect rotated surface: %v %v %v", x, y, z)
	}
	d := Document{Kind: "tiles", Width: 10, Height: 10, Tiles: []Tile{tile}, Objects: []Object{{ID: "chest", ModelID: "object", X: x, Y: y, Placement: &PlacementAnchor{TileID: "parent", Point: 0}}}}
	models := map[string]ModelMetadata{"floor": model, "object": {TileType: "object"}}
	if err := ValidateObjectModels(d, models); err != nil {
		t.Fatal(err)
	}
	if err := ValidateSurfaceAnchor(d, models, d.Objects[0].Placement, x, y); err != nil {
		t.Fatal(err)
	}
	model.CanStand = false
	models["floor"] = model
	if ValidateObjectModels(d, models) == nil {
		t.Fatal("non-standing surface accepted")
	}
}
