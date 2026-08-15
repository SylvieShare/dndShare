package systemmusic

// Track describes one versioned CC0 object uploaded to S3-compatible storage.
type Track struct {
	FileName  string
	ObjectKey string
	Size      int64
	SHA256    string
	MimeType  string
}

// Tracks is the deployment manifest for the built-in system music catalog.
var Tracks = []Track{
	{FileName: "back_to_nature.mp3", ObjectKey: "system-music/v1/back_to_nature.mp3", Size: 4113223, SHA256: "0828819e80e4053e1d5aeb9a4ac0f0a408faa00baee56c1ca95b817bcd53f243", MimeType: "audio/mpeg"},
	{FileName: "battle_theme.mp3", ObjectKey: "system-music/v1/battle_theme.mp3", Size: 4646747, SHA256: "dde7bd4f10bde031800ba8e22151fad591b7c13e1c9ae51920341b4e4ae37be5", MimeType: "audio/mpeg"},
	{FileName: "bells_of_winter.mp3", ObjectKey: "system-music/v1/bells_of_winter.mp3", Size: 2829923, SHA256: "4dd6866f5656be615d3350c834afde2a178db9bb39aa2eacb44175a5a1d78891", MimeType: "audio/mpeg"},
	{FileName: "boss_fight.mp3", ObjectKey: "system-music/v1/boss_fight.mp3", Size: 2068550, SHA256: "274387eec24462e2685f2814cb57cefe4a98af198ceff3b089ccc2ddff443d92", MimeType: "audio/mpeg"},
	{FileName: "contemplation.mp3", ObjectKey: "system-music/v1/contemplation.mp3", Size: 2405271, SHA256: "283962d3a975c93613c46cda30c9f0816176ae3e2899f961591a49e2d41b4bf3", MimeType: "audio/mpeg"},
	{FileName: "dungeon_ambience.ogg", ObjectKey: "system-music/v1/dungeon_ambience.ogg", Size: 1202848, SHA256: "18da6d6c4492d744f5ebde5bb128a636770df4197d2d4a0b5e8d65df6e27f57b", MimeType: "audio/ogg"},
	{FileName: "fairy_lights.mp3", ObjectKey: "system-music/v1/fairy_lights.mp3", Size: 3800642, SHA256: "611b9b954402fc39b3e09056be3aebe29b31d0fca9c8ba56bb9ccbef4e505c3d", MimeType: "audio/mpeg"},
	{FileName: "forest_ambience.mp3", ObjectKey: "system-music/v1/forest_ambience.mp3", Size: 716670, SHA256: "9850aa1d0d5d66bd9c5daf8bb77c6d852e01f2f4de22f283bd5621e8bed13b75", MimeType: "audio/mpeg"},
	{FileName: "forgotten_tombs.mp3", ObjectKey: "system-music/v1/forgotten_tombs.mp3", Size: 5140968, SHA256: "989b26d4c6ec9fb90da2c9c892a396920e1b2e14a426052574310e275ebd01d0", MimeType: "audio/mpeg"},
	{FileName: "homestead.mp3", ObjectKey: "system-music/v1/homestead.mp3", Size: 3293101, SHA256: "b6ce65fceb9373f32697ed27455ed995fa03a77649b04a6f3e86a0243d25d4b3", MimeType: "audio/mpeg"},
	{FileName: "jaunt.mp3", ObjectKey: "system-music/v1/jaunt.mp3", Size: 3049408, SHA256: "2ae658c0dc91b731b0c27f7a7782f081286fd8ea1b40558f09eaa40d54a77bb5", MimeType: "audio/mpeg"},
	{FileName: "jrpg_battle.mp3", ObjectKey: "system-music/v1/jrpg_battle.mp3", Size: 2929387, SHA256: "811ae1740c3f4875f860f5f22e415bd56674605aa856de6d1bb09634b951729f", MimeType: "audio/mpeg"},
	{FileName: "magic_town.mp3", ObjectKey: "system-music/v1/magic_town.mp3", Size: 1338809, SHA256: "91587673ca1c8df6d82fc197c43daf541ae2c0bc7e31c6adf6ec26f851404dd3", MimeType: "audio/mpeg"},
	{FileName: "mystical_place.mp3", ObjectKey: "system-music/v1/mystical_place.mp3", Size: 2482804, SHA256: "2fed4d5916eba03a6ce854d0c268f83afb3cd260831c0fcf033158f27ec4e832", MimeType: "audio/mpeg"},
	{FileName: "old_tower_inn.mp3", ObjectKey: "system-music/v1/old_tower_inn.mp3", Size: 2535801, SHA256: "3fe4070015b880b591c79a7fca31156a0083a8768d88a39da39ab6c54f2f014d", MimeType: "audio/mpeg"},
	{FileName: "random_battle.mp3", ObjectKey: "system-music/v1/random_battle.mp3", Size: 879890, SHA256: "c885a549b7cacb5383f2beb366984715cdf4ce631562c00b38bd0e21f836e5fd", MimeType: "audio/mpeg"},
	{FileName: "snow_day.mp3", ObjectKey: "system-music/v1/snow_day.mp3", Size: 3219005, SHA256: "d86de22290751de924068c5203ac82f11bffaa704365622d028211c29498356f", MimeType: "audio/mpeg"},
	{FileName: "springly_sprigs.mp3", ObjectKey: "system-music/v1/springly_sprigs.mp3", Size: 3340593, SHA256: "5699d453006964fc9b46ff0c5ca3c1c98d7e972e8bbdf91c9f2eab321fa56b1a", MimeType: "audio/mpeg"},
	{FileName: "tavern.ogg", ObjectKey: "system-music/v1/tavern.ogg", Size: 1034582, SHA256: "d8171fc382bce5ea8e490ed5711d6349cf3f83c7a0493dcd2d9e67cb6858e6a4", MimeType: "audio/ogg"},
	{FileName: "town.mp3", ObjectKey: "system-music/v1/town.mp3", Size: 1537924, SHA256: "d4eaa58e624cf4d29c82c2eed94a5c4e4352d85409f1f5f1d8c570d004ca4b5a", MimeType: "audio/mpeg"},
	{FileName: "wandering_woodlands.mp3", ObjectKey: "system-music/v1/wandering_woodlands.mp3", Size: 3803448, SHA256: "122c6726939e0358b916828fdf66fb275d88f4033562adfbe1c99b63803c6559", MimeType: "audio/mpeg"},
}
