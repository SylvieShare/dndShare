package web

import (
	"dndshare/internal/battlemap"
	"maps"
	"strings"
	"testing"
)

func TestMapModelURLsUseCurrentAssetHashes(t *testing.T) {
	model := battlemap.InitialCatalogue()[0]
	view := modelView(model, "/models")
	if view.ID != model.ID || view.RenderURL != "/models/"+model.ID+"/render?sha="+model.Assets["render"].SHA256 {
		t.Fatal(view)
	}
	for _, kind := range []string{"render", "lod", "preview"} {
		if view.AssetBytes[kind] != model.Assets[kind].Size || view.AssetBytes[kind] <= 0 {
			t.Fatalf("missing %s asset size: %#v", kind, view.AssetBytes)
		}
	}
	if view.AssetBytes["shadow"] != view.AssetBytes["lod"] {
		t.Fatal("shared shadow must report the actual LOD file size")
	}
	if view.ShadowURL != view.LODURL {
		t.Fatal("duplicate shared shadow download")
	}
	model.Assets = maps.Clone(model.Assets)
	asset := model.Assets["shadow"]
	asset.SHA256 = strings.Repeat("f", 64)
	asset.Key = "map-models/" + asset.SHA256 + ".glb"
	asset.Size = 321
	model.Assets["shadow"] = asset
	if modelView(model, "/models").AssetBytes["shadow"] != 321 {
		t.Fatal("dedicated shadow file size lost")
	}
	if modelView(model, "/models").ShadowURL != "/models/"+model.ID+"/shadow?sha="+asset.SHA256 {
		t.Fatal("stale shadow cache key")
	}
}
