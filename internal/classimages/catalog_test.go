package classimages

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"testing"
)

func TestCatalogAssetsMatchManifest(t *testing.T) {
	if len(Catalog) != 15 {
		t.Fatalf("got %d class images, want 15", len(Catalog))
	}
	keys := map[string]bool{}
	objects := map[string]bool{}
	for _, image := range Catalog {
		if keys[image.Key] || objects[image.ObjectKey] {
			t.Fatalf("duplicate class image %q / %q", image.Key, image.ObjectKey)
		}
		keys[image.Key], objects[image.ObjectKey] = true, true
		if !strings.HasPrefix(image.ObjectKey, "system-class-images/v1/") {
			t.Fatalf("unstable object key %q", image.ObjectKey)
		}
		if len(image.Aliases) < 2 {
			t.Fatalf("class %q must have English and Russian aliases", image.Key)
		}
		data, err := Read(image)
		if err != nil {
			t.Fatal(err)
		}
		if int64(len(data)) != image.Size {
			t.Fatalf("%s size %d, want %d", image.FileName, len(data), image.Size)
		}
		digest := sha256.Sum256(data)
		if actual := hex.EncodeToString(digest[:]); actual != image.SHA256 {
			t.Fatalf("%s SHA-256 %s, want %s", image.FileName, actual, image.SHA256)
		}
	}
}
