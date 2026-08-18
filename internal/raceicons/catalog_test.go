package raceicons

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"strings"
	"testing"
)

func TestCatalogAssetsMatchManifest(t *testing.T) {
	if len(Catalog) != 18 {
		t.Fatalf("got %d race icons, want 18", len(Catalog))
	}
	keys := map[string]bool{}
	objects := map[string]bool{}
	subraces := 0
	for _, image := range Catalog {
		if keys[image.Key] || objects[image.ObjectKey] {
			t.Fatalf("duplicate race icon %q / %q", image.Key, image.ObjectKey)
		}
		keys[image.Key], objects[image.ObjectKey] = true, true
		if image.Subrace {
			subraces++
			if !strings.Contains(image.ObjectKey, "/subraces/") {
				t.Fatalf("subrace %q must use the subrace object namespace", image.Key)
			}
		}
		if !strings.HasPrefix(image.ObjectKey, "system-race-icons/v1/") {
			t.Fatalf("unstable object key %q", image.ObjectKey)
		}
		if len(image.Aliases) < 2 {
			t.Fatalf("race icon %q must have English and Russian aliases", image.Key)
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
		assertLosslessWebP128WithAlpha(t, image.FileName, data)
	}
	if subraces != 9 {
		t.Fatalf("got %d subrace icons, want 9", subraces)
	}
}

func assertLosslessWebP128WithAlpha(t *testing.T, name string, data []byte) {
	t.Helper()
	if len(data) < 25 || string(data[:4]) != "RIFF" || string(data[8:16]) != "WEBPVP8L" || data[20] != 0x2f {
		t.Fatalf("%s is not a lossless WebP", name)
	}
	bits := binary.LittleEndian.Uint32(data[21:25])
	width := int(bits&0x3fff) + 1
	height := int((bits>>14)&0x3fff) + 1
	alpha := bits&(1<<28) != 0
	if width != 128 || height != 128 || !alpha {
		t.Fatalf("%s is %dx%d alpha=%t, want 128x128 with alpha", name, width, height, alpha)
	}
}
