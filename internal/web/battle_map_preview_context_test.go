package web

import (
	"dndshare/internal/battlemap"
	"maps"
	"testing"
)

func TestMapPreviewSignatureTracksSceneAndCurrentAssets(t *testing.T) {
	model := battlemap.InitialCatalogue()[0]
	models := []battlemap.Model{model}
	d := battlemap.Document{Version: 2, Kind: "tiles", Width: 5, Height: 5, Tiles: []battlemap.Tile{{ID: "tile", ModelID: model.ID, X: 1, Y: 1}}}
	sig := func(doc battlemap.Document, models []battlemap.Model) string {
		t.Helper()
		c, err := buildMapPreviewContext(doc, models, nil)
		if err != nil {
			t.Fatal(err)
		}
		return c.Signature
	}
	original := sig(d, models)
	d.Tags = []string{"cave"}
	if sig(d, models) != original {
		t.Fatal("tags invalidated screenshot")
	}
	d.Tiles[0].X = 2
	if sig(d, models) == original {
		t.Fatal("placement did not invalidate screenshot")
	}
	d.Tiles[0].X = 1
	model.Assets = maps.Clone(model.Assets)
	a := model.Assets["render"]
	a.SHA256 = "updated"
	model.Assets["render"] = a
	if sig(d, []battlemap.Model{model}) == original {
		t.Fatal("same-ID asset update retained old screenshot")
	}
	if _, err := buildMapPreviewContext(d, nil, nil); err == nil {
		t.Fatal("missing model accepted")
	}
}
