package systemimages

import (
	"embed"
	"fmt"
)

// Image is one verified, versioned system catalogue object.
type Image struct {
	CatalogKey string
	Scope      string
	FileName   string
	ObjectKey  string
	Size       int64
	SHA256     string
	MimeType   string
}

//go:embed assets/story/*.jpg assets/npc/*.jpg
var assets embed.FS

// Catalog is shared with the SQL seed by catalog key and stable object key.
var Catalog = []Image{
	{CatalogKey: "city", Scope: "story", FileName: "city.jpg", ObjectKey: "system-session-images/v1/story/city.jpg", Size: 115965, SHA256: "f93ecd6a16ece8694fc014086aa8ad528aaca28e978b760e81c01ef80d67297a", MimeType: "image/jpeg"},
	{CatalogKey: "village", Scope: "story", FileName: "village.jpg", ObjectKey: "system-session-images/v1/story/village.jpg", Size: 119037, SHA256: "68dc17c7aee32dd935a6856a1fd81c0e1a5fdcfd7a7e3b635ae9de10fe15ea2e", MimeType: "image/jpeg"},
	{CatalogKey: "castle", Scope: "story", FileName: "castle.jpg", ObjectKey: "system-session-images/v1/story/castle.jpg", Size: 109868, SHA256: "f03d689384d009fa6dfe1905fc50cc8ad7204b3a47eabef4f59b383124d4e92d", MimeType: "image/jpeg"},
	{CatalogKey: "tavern", Scope: "story", FileName: "tavern.jpg", ObjectKey: "system-session-images/v1/story/tavern.jpg", Size: 108219, SHA256: "de811868d049e380ee4213c9b8ccd5abdabf8a97dab84e53b699100e242c2606", MimeType: "image/jpeg"},
	{CatalogKey: "forest", Scope: "story", FileName: "forest.jpg", ObjectKey: "system-session-images/v1/story/forest.jpg", Size: 126084, SHA256: "6cb76637603a52847935824de9d65c4649133ec9dbafa336c5b8e7e6b1a2f899", MimeType: "image/jpeg"},
	{CatalogKey: "cave", Scope: "story", FileName: "cave.jpg", ObjectKey: "system-session-images/v1/story/cave.jpg", Size: 108703, SHA256: "6b0cd9ccc71c2b2eb0aaa110cace9043dfc00d3c8e24bc313f19ad47e1325726", MimeType: "image/jpeg"},
	{CatalogKey: "mountains", Scope: "story", FileName: "mountains.jpg", ObjectKey: "system-session-images/v1/story/mountains.jpg", Size: 106581, SHA256: "1d66acda71f2c26d686ef2cea815733eb0131f8a49882e15a5bca9445d8ffecc", MimeType: "image/jpeg"},
	{CatalogKey: "coast", Scope: "story", FileName: "coast.jpg", ObjectKey: "system-session-images/v1/story/coast.jpg", Size: 107689, SHA256: "1a686c80871298a242f10e4d9c0ca505ba545f4227a9b619acf4917f0059c805", MimeType: "image/jpeg"},
	{CatalogKey: "camp", Scope: "story", FileName: "camp.jpg", ObjectKey: "system-session-images/v1/story/camp.jpg", Size: 123215, SHA256: "ff68ba964da37cb2e4358502cab919bf57779804932e8a8ead76a56ffe7949f7", MimeType: "image/jpeg"},
	{CatalogKey: "road", Scope: "story", FileName: "road.jpg", ObjectKey: "system-session-images/v1/story/road.jpg", Size: 113388, SHA256: "f8db9fc5f1748b82245e5070409221ac77e41d0fd03f23fdaa35d5c8be41af31", MimeType: "image/jpeg"},
	{CatalogKey: "ruins", Scope: "story", FileName: "ruins.jpg", ObjectKey: "system-session-images/v1/story/ruins.jpg", Size: 119981, SHA256: "7f7159cd721d8ab27d1f0bd63cc9c493a8630f228642e2dc9d1a237d66b04c21", MimeType: "image/jpeg"},
	{CatalogKey: "dungeon", Scope: "story", FileName: "dungeon.jpg", ObjectKey: "system-session-images/v1/story/dungeon.jpg", Size: 98631, SHA256: "ebb1931653b90b9833457eea6ad35812c9d2ccc0d740a43e9acd6e048da788d4", MimeType: "image/jpeg"},
	{CatalogKey: "battle", Scope: "story", FileName: "battle.jpg", ObjectKey: "system-session-images/v1/story/battle.jpg", Size: 135545, SHA256: "4073ba5615964c82b8982035548549800a07b7b4bf685e1e8ab35444780400f0", MimeType: "image/jpeg"},
	{CatalogKey: "investigation", Scope: "story", FileName: "investigation.jpg", ObjectKey: "system-session-images/v1/story/investigation.jpg", Size: 148778, SHA256: "14d8298067300ece813428772a9836fc8bf376d3c5a13b138943cff41c28210e", MimeType: "image/jpeg"},
	{CatalogKey: "negotiation", Scope: "story", FileName: "negotiation.jpg", ObjectKey: "system-session-images/v1/story/negotiation.jpg", Size: 140876, SHA256: "d852008f07e3e26efeeb679a93b58722dd09277940cb8825097b71410c1427a2", MimeType: "image/jpeg"},
	{CatalogKey: "chase", Scope: "story", FileName: "chase.jpg", ObjectKey: "system-session-images/v1/story/chase.jpg", Size: 152363, SHA256: "347a1757573c34eaf71c173e54fe69ba7be89747d71be9a71665e321ccfb5baf", MimeType: "image/jpeg"},
	{CatalogKey: "puzzle", Scope: "story", FileName: "puzzle.jpg", ObjectKey: "system-session-images/v1/story/puzzle.jpg", Size: 146027, SHA256: "71906a4b68d3af4c66cca9d2613c3dd391c0186b80cbb05bb892840beeea7ce5", MimeType: "image/jpeg"},
	{CatalogKey: "discovery", Scope: "story", FileName: "discovery.jpg", ObjectKey: "system-session-images/v1/story/discovery.jpg", Size: 153716, SHA256: "a05570e29c812ade59dff449e1b43e416ae8bca7451d5396b784ac5b04d26d01", MimeType: "image/jpeg"},
	{CatalogKey: "npc-scholar", Scope: "npc", FileName: "npc-scholar.jpg", ObjectKey: "system-session-images/v1/npc/npc-scholar.jpg", Size: 120040, SHA256: "d924a1597924cf861cab57db889b7b054b924b33969411edad6e2ce2e01a81b2", MimeType: "image/jpeg"},
	{CatalogKey: "npc-artisan", Scope: "npc", FileName: "npc-artisan.jpg", ObjectKey: "system-session-images/v1/npc/npc-artisan.jpg", Size: 165782, SHA256: "b364accbc48e1f02aba57d56a091ac5e090bf1c91119577eca7b8a6896b48fff", MimeType: "image/jpeg"},
	{CatalogKey: "npc-ranger", Scope: "npc", FileName: "npc-ranger.jpg", ObjectKey: "system-session-images/v1/npc/npc-ranger.jpg", Size: 128551, SHA256: "1448b5d663db8799ac6287a8ae5442cfb57523acd2d6692b9bdfe97b088bd1ce", MimeType: "image/jpeg"},
	{CatalogKey: "npc-mercenary", Scope: "npc", FileName: "npc-mercenary.jpg", ObjectKey: "system-session-images/v1/npc/npc-mercenary.jpg", Size: 130397, SHA256: "42e7ddac1c0609a2b5de38f11c57adf0233e5f6f6b246260a213a9b9de719a59", MimeType: "image/jpeg"},
	{CatalogKey: "npc-mystic", Scope: "npc", FileName: "npc-mystic.jpg", ObjectKey: "system-session-images/v1/npc/npc-mystic.jpg", Size: 89151, SHA256: "6a7d1c2ff681037a2e07daa60fe5d395bb2026f9b6fd8a8b59652758026efe68", MimeType: "image/jpeg"},
	{CatalogKey: "npc-noble", Scope: "npc", FileName: "npc-noble.jpg", ObjectKey: "system-session-images/v1/npc/npc-noble.jpg", Size: 119904, SHA256: "78f6d6f2544c31ebeaa6adddbcd35e9ce5ec996e889ba727a0e7659957d771a0", MimeType: "image/jpeg"},
}

func Read(image Image) ([]byte, error) {
	if image.Scope != "story" && image.Scope != "npc" {
		return nil, fmt.Errorf("invalid image scope %q", image.Scope)
	}
	return assets.ReadFile("assets/" + image.Scope + "/" + image.FileName)
}
