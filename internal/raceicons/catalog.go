package raceicons

import (
	"embed"
	"fmt"
)

// Image describes one verified compact race or subrace emblem.
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

//go:embed assets/*.webp
var assets embed.FS

// Catalog uses a separate namespace from the legacy race illustrations: the
// latter are covers, while these transparent busts are compact item icons.
var Catalog = []Image{
	{Key: "human", FileName: "human.webp", ObjectKey: "system-race-icons/v1/human.webp", Size: 14166, SHA256: "57f8c4485d45bd2daf84f3996c9328cd07ffc57328bf98e1782828ddf28f29d2", MimeType: "image/webp", Aliases: []string{"human", "человек"}},
	{Key: "dwarf", FileName: "dwarf.webp", ObjectKey: "system-race-icons/v1/dwarf.webp", Size: 16046, SHA256: "c1fd81b31804761b1865ed7e44e0c7efd0c6d95d46ede9a9903018c99189d31e", MimeType: "image/webp", Aliases: []string{"dwarf", "дварф", "дворф"}},
	{Key: "elf", FileName: "elf.webp", ObjectKey: "system-race-icons/v1/elf.webp", Size: 13470, SHA256: "401c6503d7ae5f5d982a7a208ac1d2d62eda82157c54962a640c69a4c794047b", MimeType: "image/webp", Aliases: []string{"elf", "эльф"}},
	{Key: "halfling", FileName: "halfling.webp", ObjectKey: "system-race-icons/v1/halfling.webp", Size: 13704, SHA256: "73f5dec82edb99594ed726807696e3d14935f6f147f17c856ff5efd7aafbac7b", MimeType: "image/webp", Aliases: []string{"halfling", "полурослик"}},
	{Key: "gnome", FileName: "gnome.webp", ObjectKey: "system-race-icons/v1/gnome.webp", Size: 14356, SHA256: "52c73e63bc6dd02e7d5a68cd403205a68283d4b1eda0555c2aacca1c37f40f1b", MimeType: "image/webp", Aliases: []string{"gnome", "гном"}},
	{Key: "half-elf", FileName: "half-elf.webp", ObjectKey: "system-race-icons/v1/half-elf.webp", Size: 15574, SHA256: "0435fcd891c86bedd0cd8b77b092c67d31cce7d92c6a1542fe56992dc63da70a", MimeType: "image/webp", Aliases: []string{"halfelf", "полуэльф"}},
	{Key: "half-orc", FileName: "half-orc.webp", ObjectKey: "system-race-icons/v1/half-orc.webp", Size: 12802, SHA256: "32b8611aa782a6e57b43dd90d1d3ef42563d3dfd258005e16da88837eb2e23ff", MimeType: "image/webp", Aliases: []string{"halforc", "полуорк"}},
	{Key: "dragonborn", FileName: "dragonborn.webp", ObjectKey: "system-race-icons/v1/dragonborn.webp", Size: 14746, SHA256: "f91f2762b3066a23d5aece629641cd3212191debf917386d2ed943a08847a06f", MimeType: "image/webp", Aliases: []string{"dragonborn", "драконорожденный"}},
	{Key: "tiefling", FileName: "tiefling.webp", ObjectKey: "system-race-icons/v1/tiefling.webp", Size: 14676, SHA256: "3c026a728935ad41320144107631f5f55723afb571bace360c3d1be1ba01856d", MimeType: "image/webp", Aliases: []string{"tiefling", "тифлинг"}},
	{Key: "high-elf", FileName: "high-elf.webp", ObjectKey: "system-race-icons/v1/subraces/high-elf.webp", Size: 14230, SHA256: "95d8d1e63f949b7fee9229ed32005d890f0a7e151dba30d2bd7a59e1df85586e", MimeType: "image/webp", Aliases: []string{"highelf", "высшийэльф"}, Subrace: true},
	{Key: "wood-elf", FileName: "wood-elf.webp", ObjectKey: "system-race-icons/v1/subraces/wood-elf.webp", Size: 13672, SHA256: "2d453b9160e9939f7bdfc5403dd3e26c93140f838ac60305f7c1c8b3f70898f9", MimeType: "image/webp", Aliases: []string{"woodelf", "леснойэльф"}, Subrace: true},
	{Key: "drow", FileName: "drow.webp", ObjectKey: "system-race-icons/v1/subraces/drow.webp", Size: 14018, SHA256: "e75228b2a804349c315b854771620386ed6906af3db8b86160198b27167f0a7e", MimeType: "image/webp", Aliases: []string{"darkelfdrow", "темныйэльфдроу"}, Subrace: true},
	{Key: "mountain-dwarf", FileName: "mountain-dwarf.webp", ObjectKey: "system-race-icons/v1/subraces/mountain-dwarf.webp", Size: 13348, SHA256: "b7ba8408f1e0c38873c12bb890a2f32481495996bd7a7dc923bef11a657077c1", MimeType: "image/webp", Aliases: []string{"mountaindwarf", "горныйдварф"}, Subrace: true},
	{Key: "hill-dwarf", FileName: "hill-dwarf.webp", ObjectKey: "system-race-icons/v1/subraces/hill-dwarf.webp", Size: 15192, SHA256: "be22e085fb80c8a81c23dccb52cfd56b8d45d061712f26d4cde0d9edbf0378dd", MimeType: "image/webp", Aliases: []string{"hilldwarf", "холмовойдварф"}, Subrace: true},
	{Key: "forest-gnome", FileName: "forest-gnome.webp", ObjectKey: "system-race-icons/v1/subraces/forest-gnome.webp", Size: 14522, SHA256: "91a84c1e53f1cfa2a1376421fe83a842da56054a8f1f7967d5d93243540d6925", MimeType: "image/webp", Aliases: []string{"forestgnome", "леснойгном"}, Subrace: true},
	{Key: "rock-gnome", FileName: "rock-gnome.webp", ObjectKey: "system-race-icons/v1/subraces/rock-gnome.webp", Size: 14742, SHA256: "0587f777cc7c91537f676cadeacbf70fbe6424ecb7235985ba3e49f3647651a1", MimeType: "image/webp", Aliases: []string{"rockgnome", "скальныйгном"}, Subrace: true},
	{Key: "lightfoot-halfling", FileName: "lightfoot-halfling.webp", ObjectKey: "system-race-icons/v1/subraces/lightfoot-halfling.webp", Size: 13676, SHA256: "f816692924449e9808a48d09d0533430e81097fc3dfe1bcf53c909fcad7fae94", MimeType: "image/webp", Aliases: []string{"lightfoothalfling", "легконогийполурослик"}, Subrace: true},
	{Key: "stout-halfling", FileName: "stout-halfling.webp", ObjectKey: "system-race-icons/v1/subraces/stout-halfling.webp", Size: 15940, SHA256: "60b5ce284a6290ee694fdd92d1ad4528448280af839a186df68c6f3ed08854f5", MimeType: "image/webp", Aliases: []string{"stouthalfling", "коренастыйполурослик"}, Subrace: true},
}

func Read(image Image) ([]byte, error) {
	data, err := assets.ReadFile("assets/" + image.FileName)
	if err != nil {
		return nil, fmt.Errorf("read embedded race icon %q: %w", image.FileName, err)
	}
	return data, nil
}
