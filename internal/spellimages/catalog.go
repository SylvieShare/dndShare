package spellimages

import (
	"embed"
	"fmt"
)

type Image struct {
	Key       string
	FileName  string
	ObjectKey string
	Size      int64
	SHA256    string
	MimeType  string
	Aliases   []string
}

//go:embed assets/*.webp
var assets embed.FS

var Catalog = []Image{
	{Key: "fireball", FileName: "fireball.webp", ObjectKey: "system-spell-runes/v1/fireball.webp", Size: 13016, SHA256: "73ce26e59edf409b3ded6b65090ba031b036941ab14856b68e036970a55a5da0", MimeType: "image/webp", Aliases: []string{"fireball", "огненныйшар"}},
	{Key: "bless", FileName: "bless.webp", ObjectKey: "system-spell-runes/v1/bless.webp", Size: 12998, SHA256: "f123564e2bc8617b7a70a73e5221d4cd1712a1e30afdb82730205f8712639dac", MimeType: "image/webp", Aliases: []string{"bless", "blessing", "благословение"}},
	{Key: "aura-of-vitality", FileName: "aura-of-vitality.webp", ObjectKey: "system-spell-runes/v1/aura-of-vitality.webp", Size: 15836, SHA256: "0164ec42c763ce9e30da8b8dbb06ce7cd843358e7d62336a4e0b57164362de5e", MimeType: "image/webp", Aliases: []string{"auraofvitality", "аураживучести"}},
	{Key: "circle-of-scarlet", FileName: "circle-of-scarlet.webp", ObjectKey: "system-spell-runes/v1/circle-of-scarlet.webp", Size: 10160, SHA256: "93f6b16fe333b76446c215231aeb15ff750645733688f38c7398a8b0fcb5df7d", MimeType: "image/webp", Aliases: []string{"circleofscarlet", "scarletcircle", "алыйкруг"}},
}

func Read(image Image) ([]byte, error) {
	data, err := assets.ReadFile("assets/" + image.FileName)
	if err != nil {
		return nil, fmt.Errorf("read embedded spell rune %q: %w", image.FileName, err)
	}
	return data, nil
}
