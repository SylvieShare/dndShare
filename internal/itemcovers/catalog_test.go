package itemcovers

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"testing"
)

func TestCatalogAssets(t *testing.T) {
	seen := map[string]bool{}
	for _, image := range Catalog {
		if seen[image.ObjectKey] {
			t.Fatalf("duplicate object key %q", image.ObjectKey)
		}
		seen[image.ObjectKey] = true
		if !strings.HasPrefix(image.ObjectKey, "system-item-covers/v1/") {
			t.Fatalf("unstable item cover key %q", image.ObjectKey)
		}
		if image.MimeType != "image/webp" || image.Size <= 0 || image.Size > 350_000 {
			t.Fatalf("invalid item cover metadata for %q", image.Key)
		}
		data, err := Read(image)
		if err != nil {
			t.Fatal(err)
		}
		if int64(len(data)) != image.Size {
			t.Fatalf("%s size = %d, want %d", image.FileName, len(data), image.Size)
		}
		digest := sha256.Sum256(data)
		if actual := hex.EncodeToString(digest[:]); actual != image.SHA256 {
			t.Fatalf("%s SHA-256 = %s, want %s", image.FileName, actual, image.SHA256)
		}
	}
}
