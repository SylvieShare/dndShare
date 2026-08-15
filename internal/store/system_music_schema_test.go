package store

import (
	"strings"
	"testing"

	"dndshare/internal/systemmusic"
)

func TestSystemMusicSchemaIsProtectedAndComplete(t *testing.T) {
	for _, fragment := range []string{
		"music_album_owner_or_system_check",
		"music_track_owner_or_system_check",
		"'fantasy-song-pack-v1'",
		"'taverns-towns'",
		"'dungeons-atmosphere'",
		"'battles'",
		"'CC0 1.0'",
		"https://creativecommons.org/publicdomain/zero/1.0/",
	} {
		if !strings.Contains(schemaSessionsSQL, fragment) {
			t.Fatalf("session schema must contain %q", fragment)
		}
	}
	for _, track := range systemmusic.Tracks {
		if !strings.Contains(schemaSessionsSQL, track.ObjectKey) {
			t.Fatalf("session schema must contain S3 object key %q", track.ObjectKey)
		}
	}
}
