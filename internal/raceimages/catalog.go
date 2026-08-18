package raceimages

import (
	"embed"
	"fmt"
)

// Image describes one verified system race illustration and the handbook
// names whose base race item must reference it.
type Image struct {
	Key       string
	FileName  string
	ObjectKey string
	Size      int64
	SHA256    string
	MimeType  string
	Aliases   []string
}

//go:embed assets/*.jpg
var assets embed.FS

// Catalog uses stable keys so repeated deploys overwrite the same S3 objects
// and reuse the same storage_image rows.
var Catalog = []Image{
	{Key: "human", FileName: "human.jpg", ObjectKey: "system-race-images/v1/human.jpg", Size: 202273, SHA256: "17156b1f0b1c9863532d50e1e29a748ad553283956b1fadfef4216b14ce07cdd", MimeType: "image/jpeg", Aliases: []string{"human", "человек"}},
	{Key: "dwarf", FileName: "dwarf.jpg", ObjectKey: "system-race-images/v1/dwarf.jpg", Size: 238876, SHA256: "93e187b7b8dd5d0eeb032fb64f15c1d18e1069f66093d06e7192d1d0fb6ebc9d", MimeType: "image/jpeg", Aliases: []string{"dwarf", "дварф", "дворф"}},
	{Key: "elf", FileName: "elf.jpg", ObjectKey: "system-race-images/v1/elf.jpg", Size: 246609, SHA256: "c0e3b1b2b5326c1391142162198c33e4e71d19339bdb5bf9d8d7fd5325ca3d6c", MimeType: "image/jpeg", Aliases: []string{"elf", "эльф"}},
	{Key: "halfling", FileName: "halfling.jpg", ObjectKey: "system-race-images/v1/halfling.jpg", Size: 212151, SHA256: "5ddcd4781a0636fdff2751b4d6e879ebcd47308813b63e8c6431cd9497a44d14", MimeType: "image/jpeg", Aliases: []string{"halfling", "полурослик"}},
	{Key: "gnome", FileName: "gnome.jpg", ObjectKey: "system-race-images/v1/gnome.jpg", Size: 256544, SHA256: "bd4743e1df4df781707946c2e23f0299f067fc6ce4fc64d86bf9e6b007e3bea8", MimeType: "image/jpeg", Aliases: []string{"gnome", "гном"}},
	{Key: "half-elf", FileName: "half-elf.jpg", ObjectKey: "system-race-images/v1/half-elf.jpg", Size: 217227, SHA256: "209a9a7d314bd4f6796480db5436f05a4d7ec23d77185ff936ce41a56c2f28f0", MimeType: "image/jpeg", Aliases: []string{"halfelf", "полуэльф"}},
	{Key: "half-orc", FileName: "half-orc.jpg", ObjectKey: "system-race-images/v1/half-orc.jpg", Size: 208225, SHA256: "c44d04aae11cfd61ebb0a45056881b479d2380cec25f077e70ce7899177e066d", MimeType: "image/jpeg", Aliases: []string{"halforc", "полуорк"}},
	{Key: "dragonborn", FileName: "dragonborn.jpg", ObjectKey: "system-race-images/v1/dragonborn.jpg", Size: 242639, SHA256: "87471b81661e6a28a54cf2a90d8bd908e7411e08ae0ae05f6d2973274893ba63", MimeType: "image/jpeg", Aliases: []string{"dragonborn", "драконорожденный"}},
	{Key: "tiefling", FileName: "tiefling.jpg", ObjectKey: "system-race-images/v1/tiefling.jpg", Size: 229458, SHA256: "67e61256f0e07a4a6f70bf23d35bc9b56062af5d53d19bd776c8d3555755e274", MimeType: "image/jpeg", Aliases: []string{"tiefling", "тифлинг"}},
}

func Read(image Image) ([]byte, error) {
	data, err := assets.ReadFile("assets/" + image.FileName)
	if err != nil {
		return nil, fmt.Errorf("read embedded race image %q: %w", image.FileName, err)
	}
	return data, nil
}
