package web

import (
	"testing"

	"dndshare/internal/store"
)

func TestSystemMusicIsAccessibleButNeverOwned(t *testing.T) {
	const userID int64 = 42
	systemTrack := store.MusicTrack{OwnerUserID: 0, IsSystem: true}
	systemAlbum := store.MusicAlbum{OwnerUserID: 0, IsSystem: true}

	if !musicTrackAccessibleToUser(systemTrack, userID) || musicTrackOwnedByUser(systemTrack, userID) {
		t.Fatal("system track must be readable but not editable")
	}
	if !musicAlbumAccessibleToUser(systemAlbum, userID) || musicAlbumOwnedByUser(systemAlbum, userID) {
		t.Fatal("system album must be readable but not editable")
	}
}

func TestPersonalMusicIsScopedToItsOwner(t *testing.T) {
	const ownerID int64 = 42
	track := store.MusicTrack{OwnerUserID: ownerID}
	album := store.MusicAlbum{OwnerUserID: ownerID}

	if !musicTrackAccessibleToUser(track, ownerID) || !musicTrackOwnedByUser(track, ownerID) {
		t.Fatal("owner must be able to read and edit a personal track")
	}
	if musicTrackAccessibleToUser(track, 7) || musicTrackOwnedByUser(track, 7) {
		t.Fatal("another user must not access a personal track")
	}
	if !musicAlbumAccessibleToUser(album, ownerID) || !musicAlbumOwnedByUser(album, ownerID) {
		t.Fatal("owner must be able to read and edit a personal album")
	}
	if musicAlbumAccessibleToUser(album, 7) || musicAlbumOwnedByUser(album, 7) {
		t.Fatal("another user must not access a personal album")
	}
}
