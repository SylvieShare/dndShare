package systemmusic

import (
	"encoding/hex"
	"strings"
	"testing"
)

func TestSystemMusicManifest(t *testing.T) {
	if len(Tracks) != 21 {
		t.Fatalf("track count = %d, want 21", len(Tracks))
	}
	fileNames := make(map[string]bool, len(Tracks))
	objectKeys := make(map[string]bool, len(Tracks))
	for _, track := range Tracks {
		if fileNames[track.FileName] {
			t.Fatalf("duplicate file name %q", track.FileName)
		}
		fileNames[track.FileName] = true
		if objectKeys[track.ObjectKey] {
			t.Fatalf("duplicate object key %q", track.ObjectKey)
		}
		objectKeys[track.ObjectKey] = true
		if !strings.HasPrefix(track.ObjectKey, "system-music/v1/") {
			t.Errorf("object key %q must be versioned", track.ObjectKey)
		}
		if track.Size < 100_000 {
			t.Errorf("%s is unexpectedly small: %d bytes", track.FileName, track.Size)
		}
		if !strings.HasPrefix(track.MimeType, "audio/") {
			t.Errorf("%s has non-audio MIME type %q", track.FileName, track.MimeType)
		}
		if digest, err := hex.DecodeString(track.SHA256); err != nil || len(digest) != 32 {
			t.Errorf("%s has invalid SHA-256 %q", track.FileName, track.SHA256)
		}
	}
}
