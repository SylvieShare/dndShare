package store

import (
	"context"
	"dndshare/internal/battlemap"
	"errors"
	"reflect"
	"strings"
	"testing"
)

func testMapModelPreviewRevision(t *testing.T, ctx context.Context, s *Store) {
	t.Helper()
	base := battlemap.InitialCatalogue()[0]
	base.Collection = "preview-test"
	base.SourceCode = "PREVIEW-TEST"
	base.ID = "00000000-0000-4000-8000-000000000041"
	base, err := s.RegisterMapModel(ctx, base)
	if err != nil {
		t.Fatal(err)
	}
	asset := base.Assets["preview"]
	asset.SHA256 = strings.Repeat("c", 64)
	asset.Key = "map-models/" + asset.SHA256 + ".webp"
	next, err := s.UpdateMapModelPreview(ctx, base.ID, base.Assets["render"].SHA256, asset)
	if err != nil || next.ID != base.ID || next.DefinitionID != base.DefinitionID {
		t.Fatal("incompatible preview revision", err)
	}
	for _, role := range []string{"source", "render", "lod", "shadow"} {
		if next.Assets[role] != base.Assets[role] {
			t.Fatal("preview changed immutable asset", role)
		}
	}
	original, err := s.GetMapModel(ctx, base.ID)
	if err != nil || !reflect.DeepEqual(next, original) {
		t.Fatal("preview update was not visible through stable UUID", err)
	}
	repeat, err := s.UpdateMapModelPreview(ctx, base.ID, base.Assets["render"].SHA256, asset)
	if err != nil || repeat.ID != next.ID {
		t.Fatal("preview is not idempotent", err)
	}
	if _, err = s.UpdateMapModelPreview(ctx, next.ID, strings.Repeat("d", 64), asset); !errors.Is(err, ErrMapModelConflict) {
		t.Fatal("stale render accepted", err)
	}
}
