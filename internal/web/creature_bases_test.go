package web

import (
	"dndshare/internal/battlemap"
	"math"
	"testing"
)

func TestCreatureBaseMetadataValidation(t *testing.T) {
	base := battlemap.InitialCatalogue()[0]
	base.Category, base.TileType = "creature-base", "object"
	base.BaseSize, base.Width, base.Height = .5, 1, 1
	base.ReferenceDiameter = .45
	base.PlacementPoints, base.SupportSlots, base.Blockers = nil, nil, nil
	base.MountDepth, base.MountProfile = 0, ""
	if err := validateMapModel(base); err != nil {
		t.Fatal(err)
	}
	for _, mutate := range []func(*battlemap.Model){
		func(m *battlemap.Model) { m.ReferenceDiameter = 0 },
		func(m *battlemap.Model) { m.ReferenceDiameter = -1 },
		func(m *battlemap.Model) { m.ReferenceDiameter = math.Inf(1) },
		func(m *battlemap.Model) { m.ReferenceDiameter = math.NaN() },
		func(m *battlemap.Model) { m.BaseSize = 0 },
		func(m *battlemap.Model) { m.BaseSize = math.NaN() },
		func(m *battlemap.Model) { m.BaseSize = 9 },
		func(m *battlemap.Model) { m.Width = 2 },
		func(m *battlemap.Model) { m.Category = "object" },
		func(m *battlemap.Model) { m.TileType = "floor" },
	} {
		m := base
		mutate(&m)
		if validateMapModel(m) == nil {
			t.Fatal("accepted invalid creature base metadata")
		}
	}
}
