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
		properties, _ := input["properties"].(map[string]any)
		preservePrevious, _ := properties["preservePrevious"].(map[string]any)
		if preservePrevious["type"] != "boolean" {
			t.Fatalf("preservePrevious must be a boolean property: %#v", preservePrevious)
		}
		return
	}
	t.Fatal("handbook_item_set_system_image definition not found")
}

func TestMCPPublishesSystemItemTypeImageToolContract(t *testing.T) {
	for _, definition := range mcpToolDefs() {
		if definition["name"] != "handbook_item_type_set_system_image" {
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
		for _, key := range []string{"typeId", "slot", "fileName", "mimeType", "dataBase64"} {
			if !containsString(required, key) {
				t.Fatalf("required parameter %q is missing from %#v", key, required)
			}
		}
		return
	}
	t.Fatal("handbook_item_type_set_system_image definition not found")
}

func TestMCPPublishesBestiaryIconMigrationToolContract(t *testing.T) {
	for _, definition := range mcpToolDefs() {
		if definition["name"] != "handbook_bestiary_migrate_icons_to_covers" {
			continue
		}
		input, ok := definition["inputSchema"].(map[string]any)
		if !ok {
			t.Fatalf("missing input schema: %#v", definition)
		}
		properties, _ := input["properties"].(map[string]any)
		for _, key := range []string{"excludeItemIds", "apply", "expectedCandidateCount"} {
			if _, ok := properties[key]; !ok {
				t.Fatalf("migration property %q is missing from %#v", key, properties)
			}
		}
		return
	}
	t.Fatal("handbook_bestiary_migrate_icons_to_covers definition not found")
}

func TestUniquePositiveIDsNormalizesAndRejectsInvalidInput(t *testing.T) {
	ids := uniquePositiveIDs([]int64{12, 7, 12, 9})
	if len(ids) != 3 || ids[0] != 12 || ids[1] != 7 || ids[2] != 9 {
		t.Fatalf("unexpected normalized ids: %#v", ids)
	}
	if ids := uniquePositiveIDs([]int64{12, 0}); ids != nil {
		t.Fatalf("zero id must be rejected: %#v", ids)
	}
}

func TestBestiaryIconMigrationApplyRequiresWriteAuthorization(t *testing.T) {
	args := map[string]json.RawMessage{
		"apply": json.RawMessage(`true`),
	}
	_, err := (&Server{}).toolSystemBestiaryMigrateIconsToCovers(t.Context(), args)
	if err == nil || !strings.Contains(err.Error(), "write operations") {
		t.Fatalf("apply must fail without write authorization, got %v", err)
	}
}

func TestParseMCPSystemItemImageValidatesContent(t *testing.T) {
	pngHeader := []byte{'\x89', 'P', 'N', 'G', '\r', '\n', '\x1a', '\n'}
	args := map[string]json.RawMessage{
		"itemId":           json.RawMessage(`42`),
		"slot":             json.RawMessage(`" ICON "`),
		"fileName":         json.RawMessage(`" fireball.png "`),
		"mimeType":         json.RawMessage(`"IMAGE/PNG"`),
		"dataBase64":       json.RawMessage(`"` + base64.StdEncoding.EncodeToString(pngHeader) + `"`),
		"preservePrevious": json.RawMessage(`true`),
	}

	upload, err := parseMCPSystemItemImage(args)
	if err != nil {
		t.Fatalf("parseMCPSystemItemImage: %v", err)
	}
	if upload.ItemID != 42 || upload.Slot != "icon" || upload.FileName != "fireball.png" || upload.MIMEType != "image/png" || !upload.PreservePrevious {
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

func TestParseMCPSystemItemTypeImageUsesTypeID(t *testing.T) {
	pngHeader := []byte{'\x89', 'P', 'N', 'G', '\r', '\n', '\x1a', '\n'}
	args := map[string]json.RawMessage{
		"typeId":     json.RawMessage(`5`),
		"slot":       json.RawMessage(`"cover"`),
		"fileName":   json.RawMessage(`"spell-placeholder.png"`),
		"mimeType":   json.RawMessage(`"image/png"`),
		"dataBase64": json.RawMessage(`"` + base64.StdEncoding.EncodeToString(pngHeader) + `"`),
	}

	upload, err := parseMCPSystemItemTypeImage(args)
	if err != nil {
		t.Fatalf("parseMCPSystemItemTypeImage: %v", err)
	}
	if upload.TypeID != 5 || upload.Slot != "cover" {
		t.Fatalf("unexpected type upload: %#v", upload)
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

func TestSystemItemTypeMediaKeyUsesDedicatedTargetPath(t *testing.T) {
	key := systemItemTypeMediaKey(5, "cover", "image/webp", []byte("spell-placeholder"))
	if !strings.HasPrefix(key, "system-item-media/v1/item-types/5/cover/") || !strings.HasSuffix(key, ".webp") {
		t.Fatalf("unexpected item type key: %q", key)
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
