package battlemap

import "testing"

func TestTileModelsRejectUnknownOverlapAndRotatedOverflow(t *testing.T) {
	id := InitialModelID("LC-007")
	models := map[string]ModelMetadata{id: {ID: id, Width: 2, Height: 1}}
	d := Document{Version: DocumentVersion, Kind: "tiles", Width: 4, Height: 4, Tiles: []Tile{{ID: "a", ModelID: id, X: 0, Y: 0}}}
	if err := ValidateTileModels(d, models); err != nil {
		t.Fatal(err)
	}
	d.Tiles = append(d.Tiles, Tile{ID: "b", ModelID: id, X: 1, Y: 0})
	if ValidateTileModels(d, models) == nil {
		t.Fatal("accepted overlapping footprints")
	}
	d.Tiles = []Tile{{ID: "a", ModelID: id, X: 3, Y: 3, Rotation: 90}}
	if ValidateTileModels(d, models) == nil {
		t.Fatal("accepted rotated tile outside map")
	}
	d.Tiles[0].ModelID = "00000000-0000-4000-8000-000000000000"
	if ValidateTileModels(d, models) == nil {
		t.Fatal("accepted unknown model")
	}
}

func TestCatalogueIdentifiersAndAssetsAreComplete(t *testing.T) {
	seen := map[string]bool{}
	for _, m := range InitialCatalogue() {
		if seen[m.ID] || !modelIdentifier.MatchString(m.ID) {
			t.Fatalf("invalid model ID %s", m.ID)
		}
		seen[m.ID] = true
		if m.Name == "" || m.SourceCode == "" || m.SourceName == "" || m.Width < 1 || m.Height < 1 {
			t.Fatal("incomplete catalogue metadata")
		}
		for _, kind := range []string{"render", "lod", "preview", "source"} {
			asset, ok := m.Assets[kind]
			if !ok || asset.Size <= 0 || len(asset.SHA256) != 64 || asset.Key == "" {
				t.Fatalf("invalid %s asset for %s", kind, m.SourceCode)
			}
		}
	}
}
