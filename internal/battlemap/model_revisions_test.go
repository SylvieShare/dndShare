package battlemap

import "testing"

func TestVisualRevisionRequiresIdenticalPlacementAndSource(t *testing.T) {
	old := InitialCatalogue()[0]
	revision := old
	revision.ID = "new"
	revision.Version++
	if !VisualRevision(old, revision) {
		t.Fatal("identical placement contract rejected")
	}
	for name, mutate := range map[string]func(*Model){
		"footprint":   func(m *Model) { m.Width++ },
		"base origin": func(m *Model) { m.PlacementOffset[1] += .1 },
		"height":      func(m *Model) { m.MaxHeight += .1 },
		"slots":       func(m *Model) { m.SupportSlots = []SupportSlot{{Width: 1, Height: 1, Elevation: 1}} },
		"wall ports":  func(m *Model) { m.WallMask ^= 1 },
		"variant":     func(m *Model) { m.SourceName += " other" },
		"version":     func(m *Model) { m.Version = old.Version },
		"source":      func(m *Model) { m.Assets = map[string]ModelAsset{"source": {SHA256: "other"}} },
	} {
		t.Run(name, func(t *testing.T) {
			candidate := revision
			mutate(&candidate)
			if VisualRevision(old, candidate) {
				t.Fatal("incompatible visual revision accepted")
			}
		})
	}
}

func TestLatestVisualModelsDoesNotFollowIncompatibleNewestVersion(t *testing.T) {
	old := InitialCatalogue()[0]
	painted := old
	painted.ID, painted.Version = "painted", old.Version+1
	newest := painted
	newest.ID, newest.Version, newest.Width = "changed-shape", painted.Version+1, painted.Width+1
	models := LatestVisualModels([]Model{newest, old, painted})
	if models[old.ID].ID != painted.ID || models[painted.ID].ID != painted.ID || models[newest.ID].ID != newest.ID {
		t.Fatalf("unexpected revisions: %+v", models)
	}
}
