package web

import (
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"
)

func TestMCPPublishesSystemItemImageToolContract(t *testing.T) {
	for _, definition := range mcpToolDefs() {
		if definition["name"] != "handbook_item_set_system_image" {
			continue
		}
		input, ok := definition["inputSchema"].(map[string]any)
		if !ok {
			t.Fatalf("missing input schema: %#v", definition)
		}
		required, ok := input["required"].([]string)
		if !ok {
			t.Fatalf("required must be []string: %#v", input["required"])
		}
		for _, key := range []string{"itemId", "slot", "fileName", "mimeType", "dataBase64"} {
			if !containsString(required, key) {
				t.Fatalf("required parameter %q is missing from %#v", key, required)
			}
		}
		return
	}
	t.Fatal("handbook_item_set_system_image definition not found")
}

func TestParseMCPSystemItemImageValidatesContent(t *testing.T) {
	pngHeader := []byte{'\x89', 'P', 'N', 'G', '\r', '\n', '\x1a', '\n'}
	args := map[string]json.RawMessage{
		"itemId":     json.RawMessage(`42`),
		"slot":       json.RawMessage(`" ICON "`),
		"fileName":   json.RawMessage(`" fireball.png "`),
		"mimeType":   json.RawMessage(`"IMAGE/PNG"`),
		"dataBase64": json.RawMessage(`"` + base64.StdEncoding.EncodeToString(pngHeader) + `"`),
	}

	upload, err := parseMCPSystemItemImage(args)
	if err != nil {
		t.Fatalf("parseMCPSystemItemImage: %v", err)
	}
	if upload.ItemID != 42 || upload.Slot != "icon" || upload.FileName != "fireball.png" || upload.MIMEType != "image/png" {
		t.Fatalf("unexpected normalized upload: %#v", upload)
	}
}

func TestParseMCPSystemItemImageRejectsMIMEAndDataURL(t *testing.T) {
	png := base64.StdEncoding.EncodeToString([]byte{'\x89', 'P', 'N', 'G', '\r', '\n', '\x1a', '\n'})
	base := map[string]json.RawMessage{
		"itemId":   json.RawMessage(`1`),
		"slot":     json.RawMessage(`"icon"`),
		"fileName": json.RawMessage(`"icon.png"`),
		"mimeType": json.RawMessage(`"image/png"`),
	}

	base["dataBase64"] = json.RawMessage(`"data:image/png;base64,` + png + `"`)
	if _, err := parseMCPSystemItemImage(base); err == nil || !strings.Contains(err.Error(), "data URL") {
		t.Fatalf("expected data URL error, got %v", err)
	}

	base["dataBase64"] = json.RawMessage(`"` + png + `"`)
	base["mimeType"] = json.RawMessage(`"image/webp"`)
	if _, err := parseMCPSystemItemImage(base); err == nil || !strings.Contains(err.Error(), "does not match") {
		t.Fatalf("expected MIME mismatch, got %v", err)
	}
}

func TestSystemItemMediaKeyIsStableAndContentAddressed(t *testing.T) {
	first := systemItemMediaKey(42, "icon", "image/webp", []byte("one"))
	again := systemItemMediaKey(42, "icon", "image/webp", []byte("one"))
	second := systemItemMediaKey(42, "icon", "image/webp", []byte("two"))
	if first != again {
		t.Fatalf("same content must yield same key: %q != %q", first, again)
	}
	if first == second {
		t.Fatalf("different content must yield different keys: %q", first)
	}
	if !strings.HasPrefix(first, "system-item-media/v1/items/42/icon/") || !strings.HasSuffix(first, ".webp") {
		t.Fatalf("unexpected key: %q", first)
	}
}

func containsString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}
