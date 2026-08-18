package itemcovers

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
	TypeID    int64
	Aliases   []string
}

//go:embed assets/*.webp
var assets embed.FS

var Catalog = []Image{
	{Key: "fireball", FileName: "fireball.webp", ObjectKey: "system-item-covers/v1/spells/fireball.webp", Size: 89752, SHA256: "d0a950a6ae7301505c5700e806b27e215e8d0dc3bf143ddac3d9d28f6df7c1a5", MimeType: "image/webp", TypeID: 5, Aliases: []string{"fireball", "огненныйшар"}},
	{Key: "bless", FileName: "bless.webp", ObjectKey: "system-item-covers/v1/spells/bless.webp", Size: 45714, SHA256: "c07aa8bbc2c9600d1b2d5dc2c4b60559997609f85923439ef4ea728f5c131c12", MimeType: "image/webp", TypeID: 5, Aliases: []string{"bless", "blessing", "благословение"}},
	{Key: "aura-of-vitality", FileName: "aura-of-vitality.webp", ObjectKey: "system-item-covers/v1/spells/aura-of-vitality.webp", Size: 52452, SHA256: "b920859cc1cfad5a1e229facd8bef4417d69d546a236382e8a55278821da3cb7", MimeType: "image/webp", TypeID: 5, Aliases: []string{"auraofvitality", "аураживучести"}},
}

func Read(image Image) ([]byte, error) {
	data, err := assets.ReadFile("assets/" + image.FileName)
	if err != nil {
		return nil, fmt.Errorf("read embedded item cover %q: %w", image.FileName, err)
	}
	return data, nil
}
