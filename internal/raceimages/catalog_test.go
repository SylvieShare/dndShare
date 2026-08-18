package raceimages

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"testing"
)

func TestCatalogAssetsMatchManifest(t *testing.T) {
	if len(Catalog) != 18 {
		t.Fatalf("got %d race images, want 18", len(Catalog))
	}
	keys := map[string]bool{}
	objects := map[string]bool{}
	subraces := 0
	for _, image := range Catalog {
		if keys[image.Key] {
			t.Fatalf("duplicate race key %q", image.Key)
		}
		if objects[image.ObjectKey] {
			t.Fatalf("duplicate object key %q", image.ObjectKey)
		}
		keys[image.Key] = true
		objects[image.ObjectKey] = true
		if image.Subrace {
			subraces++
			if !strings.Contains(image.ObjectKey, "/subraces/") {
				t.Fatalf("subrace %q must use the subrace object namespace", image.Key)
			}
		}
		if !strings.HasPrefix(image.ObjectKey, "system-race-images/v1/") {
			t.Fatalf("unstable object key %q", image.ObjectKey)
		}
		if len(image.Aliases) < 2 {
			t.Fatalf("race %q must have English and Russian aliases", image.Key)
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
	if subraces != 9 {
		t.Fatalf("got %d subrace images, want 9", subraces)
	}
}
