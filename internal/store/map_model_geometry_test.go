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

func TestMiniatureCalibrationSurvivesGeometryStorage(t *testing.T) {
	model := battlemap.Model{ModelMetadata: battlemap.ModelMetadata{ReferenceDiameter: .9}}
	data, _, err := marshalMapModel(model)
	if err != nil {
		t.Fatal(err)
	}
	var restored battlemap.ModelMetadata
	if err := readMapModelGeometry(data, &restored); err != nil || restored.ReferenceDiameter != .9 {
		t.Fatalf("calibration lost: %+v %v", restored, err)
	}
}

func TestGeometryCannotOverrideCatalogueFields(t *testing.T) {
	m := battlemap.ModelMetadata{ID: "uuid", DefinitionID: "MT1-017", Code: "MED-lights", VariantCode: "MED-light", Name: "Погасший светильник", NameEn: "Light Off", GroupName: "Светильники", GroupNameEn: "Lights", Category: "floor", Collection: "medieval-town-vol1", SourceCode: "MT1-017", SourceName: "Light Off", TileType: "floor"}
	want := m
	err := readMapModelGeometry([]byte(`{"id":"wrong","definitionId":"wrong","code":"UD-wrong","variantCode":"UD-wrong","name":"Факел","nameEn":"Wrong","groupName":"Wrong","groupNameEn":"Wrong","category":"object","collection":"wrong","sourceCode":"wrong","sourceName":"wrong","tileType":"object","width":2,"height":1,"wallMode":"none","surfaceHeight":0.4}`), &m)
	if err != nil {
		t.Fatal(err)
	}
	if m.Width != 2 || m.Height != 1 || m.SurfaceHeight != .4 || m.WallMode != "none" {
		t.Fatal("geometry fields were not read", m)
	}
	m.Width, m.Height, m.SurfaceHeight, m.WallMode = 0, 0, 0, ""
	if m.ID != want.ID || m.DefinitionID != want.DefinitionID || m.Code != want.Code || m.VariantCode != want.VariantCode || m.Name != want.Name || m.NameEn != want.NameEn || m.GroupName != want.GroupName || m.GroupNameEn != want.GroupNameEn || m.Category != want.Category || m.Collection != want.Collection || m.SourceCode != want.SourceCode || m.SourceName != want.SourceName || m.TileType != want.TileType {
		t.Fatal("geometry overrode catalogue columns", m)
	}
}
