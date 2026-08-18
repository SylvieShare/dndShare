package raceimages

import (
	"embed"
	"fmt"
)

// Image describes one verified system race cover and the handbook names whose
// base-race or subrace item must reference it.
type Image struct {
	Key       string
	FileName  string
	ObjectKey string
	Size      int64
	SHA256    string
	MimeType  string
	Aliases   []string
	Subrace   bool
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
	{Key: "high-elf", FileName: "high-elf.jpg", ObjectKey: "system-race-images/v1/subraces/high-elf.jpg", Size: 511915, SHA256: "75eef6148b40c020b529f9bbe159a85578495ab33c847899523c9cb4817f5de7", MimeType: "image/jpeg", Aliases: []string{"highelf", "высшийэльф"}, Subrace: true},
	{Key: "wood-elf", FileName: "wood-elf.jpg", ObjectKey: "system-race-images/v1/subraces/wood-elf.jpg", Size: 529635, SHA256: "ffc2e4bf31b7d92e229466082c21a00226cb6fe8e28b33f27b570ec745b0c48f", MimeType: "image/jpeg", Aliases: []string{"woodelf", "леснойэльф"}, Subrace: true},
	{Key: "drow", FileName: "drow.jpg", ObjectKey: "system-race-images/v1/subraces/drow.jpg", Size: 527448, SHA256: "ad30afd68ee3ef17bab983176e0a2615f8f7a09fe1b6d9f738d26070b99cb4f5", MimeType: "image/jpeg", Aliases: []string{"darkelfdrow", "темныйэльфдроу"}, Subrace: true},
	{Key: "mountain-dwarf", FileName: "mountain-dwarf.jpg", ObjectKey: "system-race-images/v1/subraces/mountain-dwarf.jpg", Size: 524365, SHA256: "9892108ea6a37ae9e7fe8673b801f53011873cd6bd3aac359a3f9e06d848d013", MimeType: "image/jpeg", Aliases: []string{"mountaindwarf", "горныйдварф"}, Subrace: true},
	{Key: "hill-dwarf", FileName: "hill-dwarf.jpg", ObjectKey: "system-race-images/v1/subraces/hill-dwarf.jpg", Size: 514336, SHA256: "d3c351146ad3fa9c5de1b53f5bc9cca122dc44722ad2cdced700144bb7bd9605", MimeType: "image/jpeg", Aliases: []string{"hilldwarf", "холмовойдварф"}, Subrace: true},
	{Key: "forest-gnome", FileName: "forest-gnome.jpg", ObjectKey: "system-race-images/v1/subraces/forest-gnome.jpg", Size: 505096, SHA256: "e144d41fbcbab88be36376139f02795c0d714dc40494f382e45ca1f5cb39e3bf", MimeType: "image/jpeg", Aliases: []string{"forestgnome", "леснойгном"}, Subrace: true},
	{Key: "rock-gnome", FileName: "rock-gnome.jpg", ObjectKey: "system-race-images/v1/subraces/rock-gnome.jpg", Size: 584079, SHA256: "06fb6b682651d9cccb5a9b9beceea3e93312b0c794dfbace68421ad15b710ef0", MimeType: "image/jpeg", Aliases: []string{"rockgnome", "скальныйгном"}, Subrace: true},
	{Key: "lightfoot-halfling", FileName: "lightfoot-halfling.jpg", ObjectKey: "system-race-images/v1/subraces/lightfoot-halfling.jpg", Size: 613638, SHA256: "b74da206d0710820843dcbf77ea0626d9c3f8b3458c300c3b95dbabf140a33f7", MimeType: "image/jpeg", Aliases: []string{"lightfoothalfling", "легконогийполурослик"}, Subrace: true},
	{Key: "stout-halfling", FileName: "stout-halfling.jpg", ObjectKey: "system-race-images/v1/subraces/stout-halfling.jpg", Size: 520701, SHA256: "56da6351fba7ac64a0d03893afc784956f7c9ca576adc5928c2f4b38fa3e06ef", MimeType: "image/jpeg", Aliases: []string{"stouthalfling", "коренастыйполурослик"}, Subrace: true},
}

func Read(image Image) ([]byte, error) {
	data, err := assets.ReadFile("assets/" + image.FileName)
	if err != nil {
		return nil, fmt.Errorf("read embedded race image %q: %w", image.FileName, err)
	}
	return data, nil
}
