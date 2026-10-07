package web

import (
	"dndshare/internal/battlemap"
	"encoding/json"
	"errors"
	"maps"
	"os"
	"strings"
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
		var revisionErr error
		if os.Getenv("MAP_MODEL_NEW_SOURCE") == "1" {
			revisionErr = preparedNewSourceError(model, previous)
		} else {
			revisionErr = preparedRevisionError(model, previous)
		}
		if revisionErr != nil {
			t.Errorf("%s %s: %v", model.SourceCode, model.SourceName, revisionErr)
		}
	}
	t.Logf("validated %d model manifests", len(models))
}

func preparedNewSourceError(model battlemap.Model, previous []battlemap.Model) error {
	maximum := 0
	for _, old := range previous {
		if old.Collection != model.Collection || old.SourceCode != model.SourceCode {
			continue
		}
		if old.Assets["source"].SHA256 == model.Assets["source"].SHA256 {
			return errors.New("existing source must use the ordinary visual revision comparison")
		}
		maximum = max(maximum, old.Version)
	}
	if maximum == 0 || model.Version <= maximum {
		return errors.New("new source requires a fresh registry of the existing code and a higher version")
	}
	return nil
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

func TestPreparedNewSourceIsExplicitAndCannotBypassOrdinaryComparison(t *testing.T) {
	old := battlemap.InitialCatalogue()[0]
	model := old
	model.Version++
	if preparedNewSourceError(model, []battlemap.Model{old}) == nil {
		t.Fatal("ordinary source passed the new-source exception")
	}
	model.Assets = maps.Clone(old.Assets)
	asset := model.Assets["source"]
	asset.SHA256 = strings.Repeat("a", 64)
	model.Assets["source"] = asset
	if preparedNewSourceError(model, nil) == nil || preparedRevisionError(model, []battlemap.Model{old}) == nil {
		t.Fatal("source replacement passed without explicit comparison mode and registry")
	}
	if err := preparedNewSourceError(model, []battlemap.Model{old}); err != nil {
		t.Fatal(err)
	}
	model.Version = old.Version
	if preparedNewSourceError(model, []battlemap.Model{old}) == nil {
		t.Fatal("old version reused for a different source")
	}
}
