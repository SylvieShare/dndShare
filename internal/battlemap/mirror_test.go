package battlemap

import (
	"encoding/json"
	"math"
	"testing"
)

func TestMirroredTilePlacementAndCells(t *testing.T) {
	model := ModelMetadata{Width: 3, Height: 2, CanStand: true, PlacementPoints: []PlacementPoint{{X: .2, Y: .4, Elevation: 1, Cell: &GridCell{X: 0, Y: 0}}}, SupportSlots: []SupportSlot{{X: 0, Y: 0, Width: 1, Height: 1, Elevation: 2}}}
	tile := Tile{ID: "base", ModelID: "frame", X: 2, Y: 3, Mirrored: true}
	x, y, _ := SurfacePosition(tile, model, model.PlacementPoints[0], 0)
	if math.Abs(x-4.8) > .000001 || y != 3.4 {
		t.Fatal(x, y)
	}
	if cell := SurfaceCell(tile, model, model.PlacementPoints[0]); cell != (GridCell{X: 4, Y: 3}) {
		t.Fatal(cell)
	}
	d := Document{Version: 2, Kind: "tiles", Width: 10, Height: 10, Tiles: []Tile{tile, {ID: "upper", ModelID: "floor", X: 4, Y: 3, Level: 1}}}
	poses, err := ResolveTilePlacements(d, map[string]ModelMetadata{"frame": model, "floor": {Width: 1, Height: 1}})
	if err != nil || poses["upper"].Elevation != 2 {
		t.Fatal(poses, err)
	}
	raw, err := json.Marshal(tile)
	var loaded Tile
	if err != nil || json.Unmarshal(raw, &loaded) != nil || !loaded.Mirrored {
		t.Fatal("lost mirror flag")
	}
}
func TestMirroredBuiltinLights(t *testing.T) {
	d := Document{Width: 10, Height: 10, Tiles: []Tile{{ID: "a", ModelID: "m", X: 2, Y: 3, Mirrored: true, Rotation: 90}}}
	models := map[string]ModelMetadata{"m": {DefinitionID: "m", Width: 3, Height: 2, PlacementOffset: [2]float64{.1, .2}}}
	behaviours := map[string]ModelBehaviour{"m": {DefaultLights: []ModelLight{{Key: "light", Name: "Свет", Position: [3]float64{.2, .4, 2}}}}}
	if err := SyncBuiltinLights(&d, models, behaviours); err != nil {
		t.Fatal(err)
	}
	if len(d.Lights) != 1 || math.Abs(d.Lights[0].X-3.4) > .000001 || math.Abs(d.Lights[0].Y-5.7) > .000001 {
		t.Fatal(d.Lights)
	}
}
