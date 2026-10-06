package web

import (
	"strings"
	"testing"

	"dndshare/internal/battlemap"
)

func TestMapModelViewKeepsPlacedUUIDAndUsesRevisionCacheKey(t *testing.T) {
	old := battlemap.InitialCatalogue()[0]
	painted := old
	painted.ID = "22222222-2222-4222-8222-222222222222"
	painted.Version++
	painted.TextureDetail = "detailed"
	view := modelView(old, painted, "/public/models")
	if view.ID != old.ID || view.Version != old.Version {
		t.Fatal("view altered document identity")
	}
	if view.TextureDetail != "detailed" {
		t.Fatal("view reports the old texture workmanship instead of rendered assets")
	}
	for _, path := range []string{view.RenderURL, view.LODURL, view.PreviewURL, view.ShadowURL} {
		if !strings.Contains(path, "/"+old.ID+"/") || !strings.HasSuffix(path, "?revision="+painted.ID) {
			t.Fatal(path)
		}
	}
	if modelView(old, old, "/models").RenderURL != "/models/"+old.ID+"/render" {
		t.Fatal("unrevised model URL changed")
	}
}

func TestShadowViewReusesLODURLOrUsesDedicatedRevision(t *testing.T) {
	model := battlemap.InitialCatalogue()[0]
	view := modelView(model, model, "/models")
	if view.ShadowURL != view.LODURL {
		t.Fatal("shared LOD shadow causes a duplicate download")
	}
	dedicated := battlemap.InitialCatalogue()[0]
	dedicated.ID = "33333333-3333-4333-8333-333333333333"
	dedicated.Version++
	asset := dedicated.Assets["shadow"]
	asset.SHA256 = strings.Repeat("f", 64)
	dedicated.Assets["shadow"] = asset
	view = modelView(model, dedicated, "/models")
	if view.ShadowURL != "/models/"+model.ID+"/shadow?revision="+dedicated.ID {
		t.Fatal("dedicated shadow lost presentation revision", view.ShadowURL)
	}
}
