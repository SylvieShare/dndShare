package web

import (
	"encoding/binary"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"dndshare/internal/battlemap"
	"dndshare/internal/config"
)

func mapAssetArgs() map[string]json.RawMessage {
	return map[string]json.RawMessage{"kind": json.RawMessage(`"render"`), "fileName": json.RawMessage(`"LC-001.glb"`), "size": json.RawMessage(`84`), "sha256": json.RawMessage(`"` + strings.Repeat("a", 64) + `"`)}
}

func TestMapAssetInputValidation(t *testing.T) {
	for _, mutate := range []func(map[string]json.RawMessage){
		func(a map[string]json.RawMessage) { a["kind"] = json.RawMessage(`"unknown"`) },
		func(a map[string]json.RawMessage) { a["sha256"] = json.RawMessage(`"../../other-key"`) },
		func(a map[string]json.RawMessage) { a["fileName"] = json.RawMessage(`"file.html"`) },
		func(a map[string]json.RawMessage) { a["size"] = json.RawMessage(`33554433`) },
		func(a map[string]json.RawMessage) { a["size"] = json.RawMessage(`0`) },
	} {
		a := mapAssetArgs()
		mutate(a)
		if _, _, err := parseMapAsset(a); err == nil {
			t.Fatal("accepted invalid asset input")
		}
	}
	_, asset, err := parseMapAsset(mapAssetArgs())
	if err != nil || asset.Key != "map-models/"+strings.Repeat("a", 64)+".glb" {
		t.Fatalf("asset metadata: %+v %v", asset, err)
	}
	head := make([]byte, 84)
	copy(head, "glTF")
	binary.LittleEndian.PutUint32(head[4:], 2)
	binary.LittleEndian.PutUint32(head[8:], 84)
	if err := assetFormat(head, asset); err != nil {
		t.Fatal(err)
	}
	binary.LittleEndian.PutUint32(head[8:], 90)
	if assetFormat(head, asset) == nil {
		t.Fatal("accepted GLB length mismatch")
	}
}

func TestMapWritesRejectBeforeTouchingStorage(t *testing.T) {
	s := &Server{cfg: config.Config{MCPWriteEnabled: false}}
	r := httptest.NewRequest("POST", "/mcp", nil)
	for _, name := range []string{"map_tile_asset_prepare_upload", "map_tile_asset_complete_upload", "map_tile_model_register"} {
		if _, err := s.dispatchTool(r, name, map[string]json.RawMessage{}); err == nil || !strings.Contains(err.Error(), "disabled") {
			t.Fatalf("%s: %v", name, err)
		}
	}
}

func TestRegisteredModelMetadataValidation(t *testing.T) {
	for _, model := range battlemap.InitialCatalogue() {
		if err := validateMapModel(model); err != nil {
			t.Fatalf("%s: %v", model.SourceCode, err)
		}
	}
	m := battlemap.InitialCatalogue()[0]
	delete(m.Assets, "source")
	if validateMapModel(m) == nil {
		t.Fatal("accepted missing source asset")
	}
	m = battlemap.InitialCatalogue()[0]
	m.Width = 0
	if validateMapModel(m) == nil {
		t.Fatal("accepted invalid footprint")
	}
}

func TestMapMCPDefinitionsIncludeDirectUploads(t *testing.T) {
	names := map[string]bool{}
	for _, definition := range mcpToolDefs() {
		names[definition["name"].(string)] = true
	}
	for _, definition := range mapModelToolDefinitions() {
		if !names[definition["name"].(string)] {
			t.Fatal("missing map tool definition")
		}
	}
}
