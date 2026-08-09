package web

import "testing"

func TestCurrentBuildCommit(t *testing.T) {
	original := BuildCommit
	t.Cleanup(func() { BuildCommit = original })

	BuildCommit = " 43485ee "
	if got := currentBuildCommit(); got != "43485ee" {
		t.Fatalf("unexpected commit: %q", got)
	}
	BuildCommit = "   "
	if got := currentBuildCommit(); got != "dev" {
		t.Fatalf("empty commit must fall back to dev, got %q", got)
	}
}
