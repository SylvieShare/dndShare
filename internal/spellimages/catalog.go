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
	{Key: "conjure-plant-creatures", FileName: "conjure-plant-creatures.webp", ObjectKey: "system-spell-runes/v1/conjure-plant-creatures.webp", Size: 12068, SHA256: "e1ebf14b11d277f1a7ba7152f3c16679b0c49dd3361d7995fd4c424c9129f95f", MimeType: "image/webp", Aliases: []string{"conjureplantcreatures", "вызоввзрослогодревня"}},
	{Key: "robe-of-shards", FileName: "robe-of-shards.webp", ObjectKey: "system-spell-runes/v1/robe-of-shards.webp", Size: 14250, SHA256: "0d619bbffad45a5b6dc24e31d001e1f0b5c63e0764c4cb53c886ccaddabb809c", MimeType: "image/webp", Aliases: []string{"robeofshards", "одеяниеизосколков"}},
	{Key: "pyrotechnics", FileName: "pyrotechnics.webp", ObjectKey: "system-spell-runes/v1/pyrotechnics.webp", Size: 13186, SHA256: "2377c44951e5fabc877fa9115fbd533d0d15bc49d1b2ec8e605ec2430054bfab", MimeType: "image/webp", Aliases: []string{"pyrotechnics", "пиротехника"}},
	{Key: "mind-sliver", FileName: "mind-sliver.webp", ObjectKey: "system-spell-runes/v1/mind-sliver.webp", Size: 12502, SHA256: "3bfe18ecf545a079d8e85f4096c22545cdc40b14e1f6f7beea12e02ea470fbae", MimeType: "image/webp", Aliases: []string{"mindsliver", "расщеплениеразума"}},
	{Key: "word-of-recall", FileName: "word-of-recall.webp", ObjectKey: "system-spell-runes/v1/word-of-recall.webp", Size: 16760, SHA256: "68e0699876d91fbe7028aae56d4022a1a28e3b5b0b47e019e34f73c3519c18f6", MimeType: "image/webp", Aliases: []string{"wordofrecall", "слововозврата"}},
	{Key: "dispel-magic", FileName: "dispel-magic.webp", ObjectKey: "system-spell-runes/v1/dispel-magic.webp", Size: 11326, SHA256: "790e3dd680fddb7f056d384d0935eb8fde1340c869d6bc3a1e08dfbd0b346a66", MimeType: "image/webp", Aliases: []string{"dispelmagic", "рассеиваниемагии"}},
	{Key: "grasping-sprout", FileName: "grasping-sprout.webp", ObjectKey: "system-spell-runes/v1/grasping-sprout.webp", Size: 13530, SHA256: "7b7e079179b776f8bab057d5cf2317bb1bc7f99164cd36f8b6b6cebb9c34162e", MimeType: "image/webp", Aliases: []string{"graspingsprout", "крепкийросток"}},
	{Key: "maze-greater", FileName: "maze-greater.webp", ObjectKey: "system-spell-runes/v1/maze-greater.webp", Size: 11686, SHA256: "0a12a8be8d846822f288cf79b6fd83ce392c9a7beb24ddbf27c86a385627dbfe", MimeType: "image/webp", Aliases: []string{"mazegreater", "большойлабиринт"}},
	{Key: "thunderstorm", FileName: "thunderstorm.webp", ObjectKey: "system-spell-runes/v1/thunderstorm.webp", Size: 12992, SHA256: "6f5a9a1ffc9c72bad2fff1869b4d230f54c47dcf74f797d38192a4797df63a5d", MimeType: "image/webp", Aliases: []string{"thunderstorm", "буря"}},
	{Key: "trick-question", FileName: "trick-question.webp", ObjectKey: "system-spell-runes/v1/trick-question.webp", Size: 12806, SHA256: "a8d03f45aaee9072f202fbea554d8a289d94e73245b5da0ad6db3f2b79cfe5fc", MimeType: "image/webp", Aliases: []string{"trickquestion", "вопроссподвохом"}},
	{Key: "wild-shield", FileName: "wild-shield.webp", ObjectKey: "system-spell-runes/v1/wild-shield.webp", Size: 15300, SHA256: "da599734674422fe51b8d783fdc066ae5c59de7530f4a878ef5b4b5386e1f0ae", MimeType: "image/webp", Aliases: []string{"wildshield", "сумасбродныйщит"}},
	{Key: "planar-binding", FileName: "planar-binding.webp", ObjectKey: "system-spell-runes/v1/planar-binding.webp", Size: 16150, SHA256: "0a4c477515ae054ba7d6ac98174ab13797acd240ee5f0fb02be8f7b52f42ce13", MimeType: "image/webp", Aliases: []string{"planarbinding", "планарныеузы"}},
	{Key: "thousand-darts", FileName: "thousand-darts.webp", ObjectKey: "system-spell-runes/v1/thousand-darts.webp", Size: 15902, SHA256: "bc3b35da1e7ee294c961e3a5d05cb3e0c99db1a67511e5060a3d4cad99a109da", MimeType: "image/webp", Aliases: []string{"thousanddarts", "тысячажал"}},
	{Key: "lesser-ley-pulse", FileName: "lesser-ley-pulse.webp", ObjectKey: "system-spell-runes/v1/lesser-ley-pulse.webp", Size: 12718, SHA256: "f273732773745c1dd34ac31bb81adbb4ef0d8beab8534820a8d593ba6412dae4", MimeType: "image/webp", Aliases: []string{"lesserleypulse", "малыйимпульслей"}},
	{Key: "kinetic-jaunt", FileName: "kinetic-jaunt.webp", ObjectKey: "system-spell-runes/v1/kinetic-jaunt.webp", Size: 15376, SHA256: "10a9b0f742f59f82f4a94f5c33bd958ab207dc584c43d7a7cc12a6c46cc70246", MimeType: "image/webp", Aliases: []string{"kineticjaunt", "увлекательнаяпрогулка"}},
	{Key: "compelling-fate", FileName: "compelling-fate.webp", ObjectKey: "system-spell-runes/v1/compelling-fate.webp", Size: 12718, SHA256: "d0297c1c1e30f270078a5849f54828095cdc0f69c814c680fcbdafeaa9e4409c", MimeType: "image/webp", Aliases: []string{"compellingfate", "принужденнаясудьба"}},
	{Key: "antagonize-ua", FileName: "antagonize-ua.webp", ObjectKey: "system-spell-runes/v1/antagonize-ua.webp", Size: 14670, SHA256: "101a97592fbbfd18d9a1d74451af6e195a64798cd44ad8036ddb7aff50844339", MimeType: "image/webp", Aliases: []string{"antagonizeua", "враждебность"}},
	{Key: "thunder-rumble", FileName: "thunder-rumble.webp", ObjectKey: "system-spell-runes/v1/thunder-rumble.webp", Size: 15464, SHA256: "2635d420f85b3b03fa4a814e90372f44110fab17e75c09584ff85763455e70a9", MimeType: "image/webp", Aliases: []string{"thunderrumble", "рокотгрома"}},
	{Key: "chaotic-form", FileName: "chaotic-form.webp", ObjectKey: "system-spell-runes/v1/chaotic-form.webp", Size: 14566, SHA256: "4d4971ef069847b4f2ce4689c8978e369feff1f719071450f0c97457e57daf3d", MimeType: "image/webp", Aliases: []string{"chaoticform", "хаотичнаяформа"}},
	{Key: "flaming-sphere", FileName: "flaming-sphere.webp", ObjectKey: "system-spell-runes/v1/flaming-sphere.webp", Size: 14662, SHA256: "65e7a817e1c4f77fb10ef00b75e7a181541779a884ee61be968b531f5452f760", MimeType: "image/webp", Aliases: []string{"flamingsphere", "пылающийшар"}},
	{Key: "investiture-of-ice", FileName: "investiture-of-ice.webp", ObjectKey: "system-spell-runes/v1/investiture-of-ice.webp", Size: 17176, SHA256: "27745c0d0716c6320ee8f3dd153be19cbf308780e46ce5190c161544fb1500d2", MimeType: "image/webp", Aliases: []string{"investitureofice", "облачениельда"}},
	{Key: "tensers-transformation", FileName: "tensers-transformation.webp", ObjectKey: "system-spell-runes/v1/tensers-transformation.webp", Size: 14700, SHA256: "5fef102d82b10060536cc834cd98b0246587e73421e48b2b3e4518bd0e3072f2", MimeType: "image/webp", Aliases: []string{"tenserstransformation", "трансформациятензера"}},
	{Key: "ensnaring-strike", FileName: "ensnaring-strike.webp", ObjectKey: "system-spell-runes/v1/ensnaring-strike.webp", Size: 10660, SHA256: "cee3b05aeae0eaeba5bb70b88992cce1468c6e900a0b90b001c6b433e5fcc9fc", MimeType: "image/webp", Aliases: []string{"ensnaringstrike", "опутывающийудар"}},
	{Key: "snillocs-snowball-swarm", FileName: "snillocs-snowball-swarm.webp", ObjectKey: "system-spell-runes/v1/snillocs-snowball-swarm.webp", Size: 16174, SHA256: "fbc0c43ba2fd68a8f2f0d554d118ff454fe20462eb9fe5772d196937f1b0c538", MimeType: "image/webp", Aliases: []string{"snillocssnowballswarm", "снежныйшквалсниллока"}},
	{Key: "time-stop", FileName: "time-stop.webp", ObjectKey: "system-spell-runes/v1/time-stop.webp", Size: 12146, SHA256: "977d55ce0a257be1b6256a3ba4e5c3b15d274ead5e2f149cf1faef948ec24ff0", MimeType: "image/webp", Aliases: []string{"timestop", "остановкавремени"}},
	{Key: "labyrinth-mastery", FileName: "labyrinth-mastery.webp", ObjectKey: "system-spell-runes/v1/labyrinth-mastery.webp", Size: 12106, SHA256: "15f38be704d10d9585c5210d1e8e10ee99fb1b6dd1c83994adc8bd55eeba6c62", MimeType: "image/webp", Aliases: []string{"labyrinthmastery", "тайнылабиринта"}},
	{Key: "toll-the-dead", FileName: "toll-the-dead.webp", ObjectKey: "system-spell-runes/v1/toll-the-dead.webp", Size: 13546, SHA256: "df645b083c4e1bc766231b5dfaff584e3cf7e3a4824a6839de217e4227fa8872", MimeType: "image/webp", Aliases: []string{"tollthedead", "погребальныйзвон"}},
	{Key: "sanguine-poppet", FileName: "sanguine-poppet.webp", ObjectKey: "system-spell-runes/v1/sanguine-poppet.webp", Size: 11786, SHA256: "ceea0b7ad524442faa54352b0199a427aa3776f14729a8a96f3f62b44ae6f1b3", MimeType: "image/webp", Aliases: []string{"sanguinepoppet", "кроваваямарионетка"}},
	{Key: "funeral-song-dragonlords", FileName: "funeral-song-dragonlords.webp", ObjectKey: "system-spell-runes/v1/funeral-song-dragonlords.webp", Size: 14602, SHA256: "5266f9e2e6725b099233e81a514ea1a9b8468fe6b2489fef6d3f9b5ef97d94ad", MimeType: "image/webp", Aliases: []string{"funeralsongofthedragonlords", "погребальнаяпесньповелителейдраконов"}},
	{Key: "produce-flame", FileName: "produce-flame.webp", ObjectKey: "system-spell-runes/v1/produce-flame.webp", Size: 11460, SHA256: "5f8fc44bdc5704d7f83436bb5028329d3200ed5d573c498b51a4f1c03d286bc1", MimeType: "image/webp", Aliases: []string{"produceflame", "сотворениепламени"}},
	{Key: "ringstrike", FileName: "ringstrike.webp", ObjectKey: "system-spell-runes/v1/ringstrike.webp", Size: 16118, SHA256: "093bf0833ad4fee85cd8f9952524a8c6489af9b2de7c64e8affaaa695c351dae", MimeType: "image/webp", Aliases: []string{"ringstrike", "кольцоотталкивания"}},
	{Key: "ego-whip", FileName: "ego-whip.webp", ObjectKey: "system-spell-runes/v1/ego-whip.webp", Size: 13340, SHA256: "2d9f6188fc29ec3513010213aea7eba3a90f95d090c16d0ca27f3a967254bfd8", MimeType: "image/webp", Aliases: []string{"egowhip", "эгокнут"}},
	{Key: "living-shadows", FileName: "living-shadows.webp", ObjectKey: "system-spell-runes/v1/living-shadows.webp", Size: 13772, SHA256: "797e2b92cda977528408b20afc5d902521a8bb0bf79cb4673e757ddbbf817f00", MimeType: "image/webp", Aliases: []string{"livingshadows", "живыетени"}},
	{Key: "claws-of-darkness", FileName: "claws-of-darkness.webp", ObjectKey: "system-spell-runes/v1/claws-of-darkness.webp", Size: 14260, SHA256: "efee30f5f60a5b351f7e7a33434547b9d453aeb00b14d91216de727bef8dbe85", MimeType: "image/webp", Aliases: []string{"clawsofdarkness", "когтитьмы"}},
	{Key: "black-hand", FileName: "black-hand.webp", ObjectKey: "system-spell-runes/v1/black-hand.webp", Size: 16492, SHA256: "280cd8317f9c26fa83cb62166924b1eb1d4d2b7d6896d2c27129cc07bfb3ec98", MimeType: "image/webp", Aliases: []string{"blackhand", "чернаярука"}},
	{Key: "last-rays-dying-sun", FileName: "last-rays-dying-sun.webp", ObjectKey: "system-spell-runes/v1/last-rays-dying-sun.webp", Size: 11828, SHA256: "f4d8a34caf2acc4f22f1b1eb20ec8f76ce99e4fc8a2d3974fad891779a24e976", MimeType: "image/webp", Aliases: []string{"lastraysofthedyingsun", "последниелучизаходящегосолнца"}},
	{Key: "overclock", FileName: "overclock.webp", ObjectKey: "system-spell-runes/v1/overclock.webp", Size: 15766, SHA256: "6cdc0b0e07e6d7557ca659c68f66f232d6f07b8be889e97c3ab38bad08d36ff7", MimeType: "image/webp", Aliases: []string{"overclock", "перегрузка"}},
	{Key: "otilukes-freezing-sphere", FileName: "otilukes-freezing-sphere.webp", ObjectKey: "system-spell-runes/v1/otilukes-freezing-sphere.webp", Size: 14338, SHA256: "bd6950a9005479f1c1d4822ac16c03dbffb9ae2e244a84323214816047edc3c3", MimeType: "image/webp", Aliases: []string{"otilukesfreezingsphere", "отилюковледянойшар"}},
	{Key: "shape-water", FileName: "shape-water.webp", ObjectKey: "system-spell-runes/v1/shape-water.webp", Size: 13086, SHA256: "18f3a050c986b6e94a2c8d36edcf2246b6399ae3d2a74f65d0941b1a32fee7b9", MimeType: "image/webp", Aliases: []string{"shapewater", "формованиеводы"}},
	{Key: "shadowy-retribution", FileName: "shadowy-retribution.webp", ObjectKey: "system-spell-runes/v1/shadowy-retribution.webp", Size: 9592, SHA256: "9688810ba04de7009d8e46ce29ac277e513df66bdc41aaffea47617271691edf", MimeType: "image/webp", Aliases: []string{"shadowyretribution", "теневоевозмездие"}},
	{Key: "animal-messenger", FileName: "animal-messenger.webp", ObjectKey: "system-spell-runes/v1/animal-messenger.webp", Size: 12850, SHA256: "a5f733fa11fdf3daf3d1a57683479f9233a4adfaba0d5deca2bd6c719769ee5b", MimeType: "image/webp", Aliases: []string{"animalmessenger", "почтовоеживотное"}},
	{Key: "hold-monster", FileName: "hold-monster.webp", ObjectKey: "system-spell-runes/v1/hold-monster.webp", Size: 17302, SHA256: "596a890664c2b330360a8779900b085e3dd8a78d52521f604452a2faf81156aa", MimeType: "image/webp", Aliases: []string{"holdmonster", "удержаниечудовища"}},
	{Key: "mold-plant", FileName: "mold-plant.webp", ObjectKey: "system-spell-runes/v1/mold-plant.webp", Size: 16754, SHA256: "14090c83549be45c502d3d4f920adbbc713da589c41b5c557dc3d12829ad04b8", MimeType: "image/webp", Aliases: []string{"moldplant", "изменениерастений"}},
	{Key: "blight", FileName: "blight.webp", ObjectKey: "system-spell-runes/v1/blight.webp", Size: 12768, SHA256: "ac8fc79396cbca6cacde3e80f1fab007373eacfd42526c840eaecaa0f4d3f942", MimeType: "image/webp", Aliases: []string{"blight", "усыхание"}},
	{Key: "shapechange", FileName: "shapechange.webp", ObjectKey: "system-spell-runes/v1/shapechange.webp", Size: 14758, SHA256: "cf1deb9cbf00313fdf504483753cdaf880ddd69d1b32237338c15987d66f700c", MimeType: "image/webp", Aliases: []string{"shapechange", "полноепревращение"}},
	{Key: "lightning-lure", FileName: "lightning-lure.webp", ObjectKey: "system-spell-runes/v1/lightning-lure.webp", Size: 13218, SHA256: "1baed9e01ebe05be1083f51406700bf497077721dbf9122921a04eac5c238977", MimeType: "image/webp", Aliases: []string{"lightninglure", "лассомолнии"}},
	{Key: "mass-cure-wounds", FileName: "mass-cure-wounds.webp", ObjectKey: "system-spell-runes/v1/mass-cure-wounds.webp", Size: 14480, SHA256: "b1c3eea1f5de5a79d264816a46562d0471282b289be9fa2cf4cd910d389298f8", MimeType: "image/webp", Aliases: []string{"masscurewounds", "множественноелечениеран"}},
	{Key: "deadly-sting", FileName: "deadly-sting.webp", ObjectKey: "system-spell-runes/v1/deadly-sting.webp", Size: 14118, SHA256: "e7a2881da866e170b1f3d9a35037f8bd02e0f418e68b6056a48d7f555a0b7af3", MimeType: "image/webp", Aliases: []string{"deadlysting", "смертельноежало"}},
	{Key: "little-death", FileName: "little-death.webp", ObjectKey: "system-spell-runes/v1/little-death.webp", Size: 8732, SHA256: "72c0a7beb521515431e5e2231e435366910ef0021e14737a2ee128174ada3c4a", MimeType: "image/webp", Aliases: []string{"littledeath", "маленькаясмерть"}},
	{Key: "fire-shield", FileName: "fire-shield.webp", ObjectKey: "system-spell-runes/v1/fire-shield.webp", Size: 12644, SHA256: "f4255a700b61e8cc31888e09d9d6dfe5d3daab571235507e39f984a457e72450", MimeType: "image/webp", Aliases: []string{"fireshield", "огненныйщит"}},
}

func Read(image Image) ([]byte, error) {
	data, err := assets.ReadFile("assets/" + image.FileName)
	if err != nil {
		return nil, fmt.Errorf("read embedded spell rune %q: %w", image.FileName, err)
	}
	return data, nil
}
