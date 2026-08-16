package systemimages

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"testing"
)

func TestCatalogAssets(t *testing.T) {
	if len(Catalog) != 24 {
		t.Fatalf("catalog size = %d, want 24", len(Catalog))
	}
	keys := make(map[string]bool, len(Catalog))
	objects := make(map[string]bool, len(Catalog))
	for _, image := range Catalog {
		if keys[image.CatalogKey] || objects[image.ObjectKey] {
			t.Fatalf("duplicate catalog or object key for %q", image.CatalogKey)
		}
		keys[image.CatalogKey] = true
		objects[image.ObjectKey] = true
		if !strings.HasPrefix(image.ObjectKey, "system-session-images/v1/"+image.Scope+"/") {
			t.Errorf("unexpected object key %q", image.ObjectKey)
		}
		data, err := Read(image)
		if err != nil {
			t.Fatalf("read %s: %v", image.FileName, err)
		}
		if int64(len(data)) != image.Size {
			t.Errorf("%s size = %d, want %d", image.FileName, len(data), image.Size)
		}
		digest := sha256.Sum256(data)
		if actual := hex.EncodeToString(digest[:]); actual != image.SHA256 {
			t.Errorf("%s SHA-256 = %s, want %s", image.FileName, actual, image.SHA256)
		}
	}
}
