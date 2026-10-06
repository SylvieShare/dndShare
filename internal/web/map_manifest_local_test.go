package web

import (
	"dndshare/internal/battlemap"
	"encoding/json"
	"errors"
	"os"
	"testing"
)

func TestPreparedCollectionManifest(t *testing.T) {
	path := os.Getenv("MAP_MODEL_MANIFEST")
	if path == "" {
		t.Skip("local model assets are intentionally outside Git")
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var models []battlemap.Model
	if err = json.Unmarshal(raw, &models); err != nil {
		t.Fatal(err)
	}
	seen := map[string]bool{}
	var previous []battlemap.Model
	if previousPath := os.Getenv("MAP_MODEL_PREVIOUS_MANIFEST"); previousPath != "" {
		raw, err := os.ReadFile(previousPath)
		if err != nil {
			t.Fatal(err)
		}
		if err = json.Unmarshal(raw, &previous); err != nil {
			t.Fatal(err)
		}
	}
	for _, model := range models {
		if seen[model.ID] {
			t.Errorf("duplicate model %s", model.SourceCode)
		}
		seen[model.ID] = true
		if err := validateMapModel(model); err != nil {
			t.Errorf("%s: %v", model.SourceCode, err)
		}
		if err := preparedRevisionError(model, previous); err != nil {
			t.Errorf("%s %s: %v", model.SourceCode, model.SourceName, err)
		}
	}
	t.Logf("validated %d model manifests", len(models))
}

func preparedRevisionError(model battlemap.Model, previous []battlemap.Model) error {
	if len(previous) == 0 {
		if model.Version > 1 {
			return errors.New("MAP_MODEL_PREVIOUS_MANIFEST must contain a fresh registry for a revision")
		}
		return nil
	}
	for _, old := range previous {
		if battlemap.VisualRevision(old, model) {
			return nil
		}
	}
	return errors.New("changes the original placement/source contract")
}

func TestPreparedRevisionRequiresComparisonAndPreservesPlacement(t *testing.T) {
	old := battlemap.InitialCatalogue()[0]
	if err := preparedRevisionError(old, nil); err != nil {
		t.Fatal("first version rejected", err)
	}
	revision := old
	revision.Version++
	if err := preparedRevisionError(revision, nil); err == nil {
		t.Fatal("revision passed without comparison registry")
	}
	previous := []battlemap.Model{old}
	if err := preparedRevisionError(revision, previous); err != nil {
		t.Fatal("compatible revision rejected", err)
	}
	revision.MountDepth += .1
	if err := preparedRevisionError(revision, previous); err == nil {
		t.Fatal("changed insertion depth accepted")
	}
}
