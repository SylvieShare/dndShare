package web

import (
	"encoding/base64"
	"encoding/json"
	"testing"
)

func TestParseInventoryIconPreset(t *testing.T) {
	args := map[string]json.RawMessage{}
	encoded := base64.StdEncoding.EncodeToString([]byte("RIFF\x04\x00\x00\x00WEBPVP8 "))
	raw, _ := json.Marshal(map[string]any{"typeId": 2, "code": "key", "name": " Ключ ", "purpose": "item", "fileName": "key.webp", "mimeType": "image/webp", "dataBase64": encoded})
	_ = json.Unmarshal(raw, &args)
	p, upload, err := parseInventoryIconPreset(args)
	if err != nil || p.ItemTypeID != 2 || p.Name != "Ключ" || upload.Slot != "icon" {
		t.Fatalf("preset: %+v, upload: %+v, error: %v", p, upload, err)
	}
	for key, value := range map[string]json.RawMessage{"code": json.RawMessage(`"../key"`), "name": json.RawMessage(`" "`), "purpose": json.RawMessage(`"cover"`), "sortOrder": json.RawMessage(`-1`), "typeId": json.RawMessage(`0`)} {
		old, exists := args[key]
		args[key] = value
		if _, _, err := parseInventoryIconPreset(args); err == nil {
			t.Fatalf("accepted invalid %s", key)
		}
		if exists {
			args[key] = old
		} else {
			delete(args, key)
		}
	}
}

func TestInventoryIconPresetRequiresMCPWrite(t *testing.T) {
	if _, err := (&Server{}).toolInventoryIconPresetSetImage(t.Context(), nil); err == nil {
		t.Fatal("must require MCP write authorization before any upload")
	}
}
