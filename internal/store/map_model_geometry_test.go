package store

import (
	"encoding/json"
	"testing"

	"dndshare/internal/battlemap"
)

func TestMapModelTextureDetailPersistsInMetadataJSON(t *testing.T) {
	for _, level := range []string{"basic", "detailed"} {
		model := battlemap.InitialCatalogue()[0]
		model.TextureDetail = level
		geometry, _, err := marshalMapModel(model)
		if err != nil {
			t.Fatal(err)
		}
		var restored battlemap.ModelMetadata
		if err := json.Unmarshal(geometry, &restored); err != nil || restored.TextureDetail != level {
			t.Fatalf("texture detail readback: %+v %v", restored, err)
		}
	}
}

func TestMountProfilesSurviveGeometryStorage(t *testing.T) {
	model := battlemap.Model{ModelMetadata: battlemap.ModelMetadata{MountDepth: .2, MountProfile: "xl-ring", SupportSlots: []battlemap.SupportSlot{{Width: 3, Height: 3, Elevation: 1, InsertionRise: .01, InsertionRises: map[string]float64{"xl-ring": .08, "db-pins": .1}}}}}
	data, _, err := marshalMapModel(model)
	if err != nil {
		t.Fatal(err)
	}
	var restored battlemap.ModelMetadata
	if err := json.Unmarshal(data, &restored); err != nil {
		t.Fatal(err)
	}
	if restored.MountProfile != model.MountProfile || restored.SupportSlots[0].InsertionRises["xl-ring"] != .08 || restored.SupportSlots[0].InsertionRises["db-pins"] != .1 || restored.SupportSlots[0].InsertionRise != .01 {
		t.Fatalf("mount profiles lost: %+v", restored)
	}
}
