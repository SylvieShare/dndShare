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
	for _, path := range []string{view.RenderURL, view.LODURL, view.PreviewURL} {
		if !strings.Contains(path, "/"+old.ID+"/") || !strings.HasSuffix(path, "?revision="+painted.ID) {
			t.Fatal(path)
		}
	}
	if modelView(old, old, "/models").RenderURL != "/models/"+old.ID+"/render" {
		t.Fatal("unrevised model URL changed")
	}
}
