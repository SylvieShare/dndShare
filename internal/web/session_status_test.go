package web

import "testing"

func TestSessionStatusValidation(t *testing.T) {
	for _, status := range []string{"active", "stopped", "completed"} {
		if !validSessionStatus(status) {
			t.Errorf("rejected session status %q", status)
		}
	}
	for _, status := range []string{"", "paused", "running", "deleted", "ACTIVE", " active "} {
		if validSessionStatus(status) {
			t.Errorf("accepted invalid session status %q", status)
		}
	}
}
