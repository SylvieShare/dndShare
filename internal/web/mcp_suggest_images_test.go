package web

import (
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"
)

func TestSuggestImageUploadValidatesIdentityAndImage(t *testing.T) {
	args := map[string]json.RawMessage{
		"typeId": json.RawMessage(`17`), "id": json.RawMessage(`3`),
		"fileName": json.RawMessage(`"gold.webp"`), "mimeType": json.RawMessage(`"image/webp"`),
		"dataBase64": json.RawMessage(`"` + base64.StdEncoding.EncodeToString([]byte("RIFF1234WEBPVP8 ")) + `"`),
	}
	typeID, upload, err := parseMCPSuggestImage(args)
	if err != nil || typeID != 17 || upload.ItemID != 3 || upload.Slot != "icon" || upload.MIMEType != "image/webp" {
		t.Fatalf("WebP upload: %d %+v %v", typeID, upload, err)
	}
	for _, key := range []string{"typeId", "id"} {
		original := args[key]
		args[key] = json.RawMessage(`0`)
		if _, _, err := parseMCPSuggestImage(args); err == nil {
			t.Fatalf("zero %s must be rejected", key)
		}
		args[key] = original
	}
	args["mimeType"] = json.RawMessage(`"image/png"`)
	if _, _, err := parseMCPSuggestImage(args); err == nil || !strings.Contains(err.Error(), "does not match") {
		t.Fatalf("MIME mismatch must be rejected: %v", err)
	}
	args["mimeType"] = json.RawMessage(`"image/jpeg"`)
	if _, _, err := parseMCPSuggestImage(args); err == nil {
		t.Fatal("JPEG icon must be rejected")
	}
}

func TestSuggestImageUploadRequiresWriteAuthorization(t *testing.T) {
	_, err := (&Server{}).toolSuggestSetSystemImage(t.Context(), nil)
	if err == nil || !strings.Contains(err.Error(), "write operations") {
		t.Fatalf("unauthorized image upload: %v", err)
	}
}
