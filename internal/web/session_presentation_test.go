package web

import "testing"

func TestIdlePresentationCanShowClearedCanvas(t *testing.T) {
	shown := true
	hidden := false
	if !sessionPresentationVisible("idle", &shown) {
		t.Fatal("explicitly cleared presentation must keep the canvas visible")
	}
	if sessionPresentationVisible("idle", &hidden) {
		t.Fatal("blackout must still be able to hide an idle presentation")
	}
	if sessionPresentationVisible("idle", nil) {
		t.Fatal("legacy idle request without visibility must remain hidden")
	}
}
