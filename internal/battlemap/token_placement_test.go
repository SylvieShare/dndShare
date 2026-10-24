package battlemap

import "testing"

func tokenPlacementScene() (Document, map[string]ModelMetadata, State) {
	model := ModelMetadata{ID: "floor", Width: 1, Height: 1, CanStand: true, PlacementPoints: []PlacementPoint{{X: .3, Y: .6, Elevation: .4, Cell: &GridCell{X: 0, Y: 0}}}}
	d := Document{Kind: "tiles", Width: 5, Height: 5}
	for y := 0; y < 2; y++ {
		for x := 0; x < 2; x++ {
			d.Tiles = append(d.Tiles, Tile{ID: string(rune('a' + y*2 + x)), ModelID: "floor", X: x, Y: y})
		}
	}
	s := InitialState()
	s.Tokens = []Token{{ID: "ogre", Kind: "creature", Size: 2, X: .3, Y: .6, Placement: &PlacementAnchor{TileID: "a", Point: 0}}}
	return d, map[string]ModelMetadata{"floor": model}, s
}

func TestFullCreatureFootprintAndCanonicalCentre(t *testing.T) {
	d, models, s := tokenPlacementScene()
	if err := ValidateTokenPlacements(d, &s, models); err != nil {
		t.Fatal(err)
	}
	if s.Tokens[0].X != 1 || s.Tokens[0].Y != 1 {
		t.Fatalf("not centred: %+v", s.Tokens[0])
	}
	// A rotated/reflected anchor may be any corner; the stored local offset
	// still resolves to the centre of the same world-space four-cell block.
	d.Tiles[0].Rotation = 90
	d.Tiles[0].Mirrored = true
	offset := [2]float64{-.3, -.6}
	s.Tokens[0].AnchorOffset = &offset
	if err := ValidateTokenPlacements(d, &s, models); err != nil {
		t.Fatal(err)
	}
	if s.Tokens[0].X != 1 || s.Tokens[0].Y != 1 {
		t.Fatalf("lost reflected centre: %+v", s.Tokens[0])
	}
}

func TestCreatureFootprintRequiresAllCellsAndRejectsOverlap(t *testing.T) {
	d, models, s := tokenPlacementScene()
	d.Tiles = d.Tiles[:3]
	if ValidateTokenPlacements(d, &s, models) == nil {
		t.Fatal("accepted unsupported fourth cell")
	}
	d, models, s = tokenPlacementScene()
	s.Tokens = append(s.Tokens, Token{ID: "hero", Kind: "player", Size: 1, Placement: &PlacementAnchor{TileID: "d", Point: 0}})
	if ValidateTokenPlacements(d, &s, models) == nil {
		t.Fatal("accepted player inside the far corner")
	}
	s.Tokens[1].Kind = "marker"
	s.Tokens[1].X, s.Tokens[1].Y = 1.3, 1.6
	if err := ValidateTokenPlacements(d, &s, models); err != nil {
		t.Fatal(err)
	}
}

func TestImageCreatureFootprintBoundsAndOverlap(t *testing.T) {
	d := Document{Kind: "image", Width: 8, Height: 8}
	s := InitialState()
	s.Tokens = []Token{{ID: "ogre", Kind: "creature", Size: 2, X: 2.2, Y: 3.3}}
	if err := ValidateTokenPlacements(d, &s, nil); err != nil {
		t.Fatal(err)
	}
	if s.Tokens[0].X != 2 || s.Tokens[0].Y != 3 {
		t.Fatal("image footprint did not snap")
	}
	s.Tokens = append(s.Tokens, Token{ID: "hero", Kind: "player", Size: 1, X: 2.5, Y: 3.5, Hidden: true})
	if ValidateTokenPlacements(d, &s, nil) == nil {
		t.Fatal("accepted overlap with hidden creature")
	}
	s.Tokens = s.Tokens[:1]
	s.Tokens[0].X = .1
	if ValidateTokenPlacements(d, &s, nil) == nil {
		t.Fatal("accepted footprint outside map")
	}
}

func TestCreatureOccupancyRespectsLogicalCellAndSeparateFloors(t *testing.T) {
	d, models, s := tokenPlacementScene()
	model := models["floor"]
	model.SupportSlots = []SupportSlot{{X: 0, Y: 0, Width: 1, Height: 1, Elevation: 1}}
	models["floor"] = model
	d.Tiles = append(d.Tiles, Tile{ID: "upper", ModelID: "floor", X: 0, Y: 0, Level: 1})
	s.Tokens = append(s.Tokens, Token{ID: "hero", Kind: "player", Size: 1, Placement: &PlacementAnchor{TileID: "upper", Point: 0}})
	if err := ValidateTokenPlacements(d, &s, models); err != nil {
		t.Fatal("different floors collide", err)
	}
	s.Tokens[1].Placement.TileID = "a"
	if ValidateTokenPlacements(d, &s, models) == nil {
		t.Fatal("same floor overlap accepted")
	}
	// Physical point and assigned gameplay cell are intentionally independent.
	model.Width = 2
	model.PlacementPoints[0].Cell = &GridCell{X: 1, Y: 0}
	d = Document{Kind: "tiles", Width: 5, Height: 5, Tiles: []Tile{{ID: "floor", ModelID: "wide"}}}
	s.Tokens = []Token{{ID: "npc", Kind: "creature", Size: 1, Placement: &PlacementAnchor{TileID: "floor", Point: 0}}, {ID: "player", Kind: "player", Size: 1, X: 1.5, Y: .5}}
	if ValidateTokenPlacements(d, &s, map[string]ModelMetadata{"wide": model}) == nil {
		t.Fatal("logical cell was ignored")
	}
}
