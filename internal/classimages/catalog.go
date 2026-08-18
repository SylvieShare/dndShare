package classimages

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

//go:embed assets/*.jpg
var assets embed.FS

var Catalog = []Image{
	{Key: "bard", FileName: "bard.jpg", ObjectKey: "system-class-images/v1/bard.jpg", Size: 574061, SHA256: "181faf107314b90e7d8c296536fdbbc31fbadc0317eaab71f3920e77cd9331c7", MimeType: "image/jpeg", Aliases: []string{"bard", "бард"}},
	{Key: "barbarian", FileName: "barbarian.jpg", ObjectKey: "system-class-images/v1/barbarian.jpg", Size: 498038, SHA256: "bd7f5669fefc8d16887ac32b7cd293333c5defdb10ae7d3e0f7c90113b9cf004", MimeType: "image/jpeg", Aliases: []string{"barbarian", "варвар"}},
	{Key: "fighter", FileName: "fighter.jpg", ObjectKey: "system-class-images/v1/fighter.jpg", Size: 545381, SHA256: "391e460cd57a711bc286b5dc34edd9199c414cec94f100e8790ebdbdde8f597f", MimeType: "image/jpeg", Aliases: []string{"fighter", "воин"}},
	{Key: "wizard", FileName: "wizard.jpg", ObjectKey: "system-class-images/v1/wizard.jpg", Size: 566257, SHA256: "994e679f9fd3ec49743de2535bda232e10b60c7671f8c130d18c54d2907aa7a7", MimeType: "image/jpeg", Aliases: []string{"wizard", "волшебник"}},
	{Key: "druid", FileName: "druid.jpg", ObjectKey: "system-class-images/v1/druid.jpg", Size: 558217, SHA256: "b2007f1e4da319280aa400724ee0a60e3b9e168c4211c74f26823c2a76ee733a", MimeType: "image/jpeg", Aliases: []string{"druid", "друид"}},
	{Key: "cleric", FileName: "cleric.jpg", ObjectKey: "system-class-images/v1/cleric.jpg", Size: 596185, SHA256: "f407ceb23f98ac6612895dd3af36b281bd42c13a7e705ecdef2533ce2834db34", MimeType: "image/jpeg", Aliases: []string{"cleric", "жрец"}},
	{Key: "artificer", FileName: "artificer.jpg", ObjectKey: "system-class-images/v1/artificer.jpg", Size: 551053, SHA256: "06c7fdb34d9f521514799b3ed6fce7c185610a3170b484443f4b5a5fc2e6e8a0", MimeType: "image/jpeg", Aliases: []string{"artificer", "изобретатель"}},
	{Key: "warlock", FileName: "warlock.jpg", ObjectKey: "system-class-images/v1/warlock.jpg", Size: 497611, SHA256: "f39ecf95441142b8eee467f10e82d6c1d56649c0c3a664a4659db724efb49a2b", MimeType: "image/jpeg", Aliases: []string{"warlock", "колдун"}},
	{Key: "magus", FileName: "magus.jpg", ObjectKey: "system-class-images/v1/magus.jpg", Size: 527200, SHA256: "8cb173562b19e5f42bd9c7db079d7a25d3b187771add5da882c1f74f8cd6e65b", MimeType: "image/jpeg", Aliases: []string{"magus", "магус"}},
	{Key: "monk", FileName: "monk.jpg", ObjectKey: "system-class-images/v1/monk.jpg", Size: 531900, SHA256: "1fbffd9e2da0ff0dddee83783a0c56c594a93ebbf1e41ad76b5ccaebbdc48476", MimeType: "image/jpeg", Aliases: []string{"monk", "монах"}},
	{Key: "paladin", FileName: "paladin.jpg", ObjectKey: "system-class-images/v1/paladin.jpg", Size: 653855, SHA256: "c1030c87a4445b2f26b067e24a4a7e174f88be3700eb4c070e5c7e87d5b2d0da", MimeType: "image/jpeg", Aliases: []string{"paladin", "паладин"}},
	{Key: "rogue", FileName: "rogue.jpg", ObjectKey: "system-class-images/v1/rogue.jpg", Size: 440049, SHA256: "99a904f3f3dbef929dba85ab6428a38844fbf3f9b2036e917936d6ea3ce47918", MimeType: "image/jpeg", Aliases: []string{"rogue", "плут"}},
	{Key: "ranger", FileName: "ranger.jpg", ObjectKey: "system-class-images/v1/ranger.jpg", Size: 570951, SHA256: "7a7f4842f80b90edc0d0ad31c50251280f27241c617857be2735e0bc158f63a3", MimeType: "image/jpeg", Aliases: []string{"ranger", "следопыт"}},
	{Key: "sorcerer", FileName: "sorcerer.jpg", ObjectKey: "system-class-images/v1/sorcerer.jpg", Size: 575105, SHA256: "b20e2bfc33890b56f6386716497bf0fd98b163f08a691bdc936cb43ccb5d1c5b", MimeType: "image/jpeg", Aliases: []string{"sorcerer", "чародей"}},
	{Key: "shaman", FileName: "shaman.jpg", ObjectKey: "system-class-images/v1/shaman.jpg", Size: 611686, SHA256: "f6faa27fadbd83249b808062a7736c0646af1f2fdaf3f520ac4a8c7862adb74e", MimeType: "image/jpeg", Aliases: []string{"shaman", "шаман"}},
}

func Read(image Image) ([]byte, error) {
	data, err := assets.ReadFile("assets/" + image.FileName)
	if err != nil {
		return nil, fmt.Errorf("read embedded class image %q: %w", image.FileName, err)
	}
	return data, nil
}
