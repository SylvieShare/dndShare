package web

import (
	"math"
	"reflect"
	"testing"

	"dndshare/internal/battlemap"
)

func TestEditedMapModelPreservesIdentityAndAssets(t *testing.T) {
	original := battlemap.InitialCatalogue()[0]
	original.Code = "LC-wall"
	input := original.ModelMetadata
	input.Name = "  Исправленная стена  "
	input.Width = 2
	input.TextureDetail = "detailed"
	input.TileType = "wall-angle"
	input.PlacementOffset = [2]float64{-.25, .1}
	edited, err := editedMapModel(original, input)
	if err != nil {
		t.Fatal(err)
	}
	if edited.Name != "Исправленная стена" || edited.Width != 2 || edited.PlacementOffset != input.PlacementOffset {
		t.Fatalf("edit not applied: %+v", edited.ModelMetadata)
	}
	if edited.TextureDetail != "detailed" || original.TextureDetail != "basic" || edited.TileType != "wall-angle" || original.TileType != "wall-straight" {
		t.Fatal("texture detail edit was not isolated to the new metadata")
	}
	if !reflect.DeepEqual(edited.Assets, original.Assets) || edited.ID != original.ID {
		t.Fatal("metadata edit changed assets or immutable identity")
	}
	if original.Name == edited.Name || original.Width != 1 {
		t.Fatal("edited the original value")
	}
}
func TestEditedMapModelRejectsIdentityChangesAndInvalidGeometry(t *testing.T) {
	original := battlemap.InitialCatalogue()[0]
	original.Code = "LC-wall"
	for _, change := range []func(*battlemap.ModelMetadata){
		func(m *battlemap.ModelMetadata) { m.ID = "00000000-0000-4000-8000-000000000001" },
		func(m *battlemap.ModelMetadata) { m.Collection = "other" },
		func(m *battlemap.ModelMetadata) { m.CollectionName = "Other" },
		func(m *battlemap.ModelMetadata) { m.SourceCode = "OTHER-001" },
		func(m *battlemap.ModelMetadata) { m.SourceName = "other" },
		func(m *battlemap.ModelMetadata) { m.Width = 0 },
		func(m *battlemap.ModelMetadata) { m.TileType = "wall" },
		func(m *battlemap.ModelMetadata) { m.TileType = "wall-unknown" },
		func(m *battlemap.ModelMetadata) { m.TileType = "wall-custom" },
		func(m *battlemap.ModelMetadata) { m.MaxHeight = math.NaN() },
		func(m *battlemap.ModelMetadata) {
			m.SupportSlots = []battlemap.SupportSlot{{Width: 1, Height: 1, Elevation: 99}}
		},
		func(m *battlemap.ModelMetadata) { m.Blockers = [][][2]float64{{{math.NaN(), 0}, {0, 0}, {1, 0}}} },
	} {
		input := original.ModelMetadata
		change(&input)
		if _, err := editedMapModel(original, input); err == nil {
			t.Fatalf("accepted invalid edit: %+v", input)
		}
	}
}
