package web

import (
	"dndshare/internal/battlemap"
	"dndshare/internal/store"
	"encoding/json"
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

func TestMapPreviewIgnoresLabelsButTracksVisibleLightAndAreas(t *testing.T) {
	model := battlemap.InitialCatalogue()[0]
	d := battlemap.Document{Version: 2, Width: 5, Height: 5,
		Tiles:  []battlemap.Tile{{ID: "tile", ModelID: model.ID}},
		Zones:  []battlemap.Zone{{ID: "zone", Name: "Zone"}},
		Areas:  []battlemap.Area{{ID: "area", Name: "Area", Color: "#ff0000", TileIDs: []string{"tile"}}},
		Lights: []battlemap.Light{{ID: "light", Name: "Light", Color: "#ff0000", Height: 2, ShowMarker: true}},
	}
	behaviour := battlemap.ModelBehaviour{Revision: 1, DefaultLights: []battlemap.ModelLight{{Name: "Lamp", Flicker: true}}}
	build := func() mapPreviewContext {
		t.Helper()
		c, err := buildMapPreviewContext(d, []battlemap.Model{model}, map[string]battlemap.ModelBehaviour{model.DefinitionID: behaviour})
		if err != nil {
			t.Fatal(err)
		}
		return c
	}
	before, _ := json.Marshal(d)
	original := build()
	after, _ := json.Marshal(d)
	if string(before) != string(after) || original.Document.Areas[0].Name != "Area" || original.Models[0].Behaviour.DefaultLights[0].Name != "Lamp" {
		t.Fatal("signature normalization changed the original document or renderer context")
	}
	d.Zones[0].Name = "Renamed zone"
	d.Areas[0].Name, d.Areas[0].Color = "Renamed area", "#00ff00"
	d.Lights[0].Name, d.Lights[0].ShowMarker, d.Lights[0].Flicker = "Renamed light", false, true
	model.Name, model.NameEn, model.GroupName, model.Tags = "Renamed model", "Renamed", "Group", []string{"tag"}
	behaviour.Revision++
	behaviour.DefaultLights[0].Name = "Renamed lamp"
	behaviour.DefaultLights[0].Flicker = false
	if build().Signature != original.Signature {
		t.Fatal("labels or animation invalidated a static capture")
	}
	d.Lights[0].Overrides = &battlemap.LightOverrides{Flicker: new(bool), ShowMarker: new(bool)}
	if build().Signature != original.Signature {
		t.Fatal("marker override invalidated a static capture")
	}
	d.Lights[0].Overrides = nil
	d.Lights[0].Color = "#0000ff"
	if build().Signature == original.Signature {
		t.Fatal("visible light change retained a stale capture")
	}
	d.Lights[0].Color = "#ff0000"
	d.Areas[0].Hidden = true
	if build().Signature == original.Signature {
		t.Fatal("hidden area retained a stale capture")
	}
}

func TestMapPreviewRetainsItsPreviousImageUntilReplacement(t *testing.T) {
	m := store.BattleMap{ID: "map", PreviewSignature: "current"}
	applyMapPreview(&m, "current", store.MapPreview{Signature: "previous"})
	if !m.PreviewStale || m.PreviewURL != mapPreviewURL("map", "previous") || m.PreviewSignature != "current" {
		t.Fatalf("previous image was lost: %+v", m)
	}
	applyMapPreview(&m, "current", store.MapPreview{Signature: "current"})
	if m.PreviewStale || m.PreviewURL != mapPreviewURL("map", "current") {
		t.Fatalf("fresh preview is still stale: %+v", m)
	}
}

func TestMapPreviewSignatureIgnoresDownloadSizes(t *testing.T) {
	model := battlemap.InitialCatalogue()[0]
	d := battlemap.Document{Version: 2, Kind: "tiles", Width: 5, Height: 5, Tiles: []battlemap.Tile{{ID: "tile", ModelID: model.ID, X: 1, Y: 1}}}
	before, err := buildMapPreviewContext(d, []battlemap.Model{model}, nil)
	if err != nil {
		t.Fatal(err)
	}
	model.Assets = maps.Clone(model.Assets)
	asset := model.Assets["render"]
	asset.Size++
	model.Assets["render"] = asset
	after, err := buildMapPreviewContext(d, []battlemap.Model{model}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if before.Signature != after.Signature {
		t.Fatal("transfer sizes invalidated the stored screenshot")
	}
	if after.Models[0].AssetBytes["render"] != asset.Size {
		t.Fatal("preview loader did not receive the current download size")
	}
}
