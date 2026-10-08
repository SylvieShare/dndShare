package web

import (
	"dndshare/internal/battlemap"
	"encoding/json"
	"errors"
	"maps"
	"os"
	"reflect"
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
		if os.Getenv("MAP_MODEL_NEW_SOURCE") == "1" && os.Getenv("MAP_MODEL_GEOMETRY_CORRECTION") == "1" {
			revisionErr = errors.New("choose one explicit correction mode")
		} else if os.Getenv("MAP_MODEL_GEOMETRY_CORRECTION") == "1" {
			revisionErr = preparedGeometryCorrectionError(model, previous, os.Getenv("MAP_MODEL_CORRECTION_REASON"))
		} else if os.Getenv("MAP_MODEL_NEW_SOURCE") == "1" {
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

func preparedRevisionError(model battlemap.Model, previous []battlemap.Model) error {
	if len(previous) == 0 {
		return nil
	}
	for _, old := range previous {
		if old.ID != model.ID {
			continue
		}
		a, b := old.ModelMetadata, model.ModelMetadata
		a.TextureDetail, b.TextureDetail = "", ""
		if !reflect.DeepEqual(a, b) || old.Assets["source"] != model.Assets["source"] {
			return errors.New("changes placement/source contract; use explicit correction mode")
		}
		return nil
	}
	return errors.New("existing model must preserve its UUID")
}
func preparedNewSourceError(model battlemap.Model, previous []battlemap.Model) error {
	for _, old := range previous {
		if old.ID == model.ID && old.Assets["source"].SHA256 != model.Assets["source"].SHA256 {
			return nil
		}
	}
	return errors.New("new source requires a current registry, stable UUID and changed source")
}
func TestPreparedUpdatesRetainUUIDAndPlacement(t *testing.T) {
	old := battlemap.InitialCatalogue()[0]
	model := old
	if err := preparedRevisionError(model, []battlemap.Model{old}); err != nil {
		t.Fatal(err)
	}
	model.MountDepth += .1
	if preparedRevisionError(model, []battlemap.Model{old}) == nil {
		t.Fatal("changed datum accepted")
	}
	model = old
	model.ID = "different"
	if preparedRevisionError(model, []battlemap.Model{old}) == nil {
		t.Fatal("new UUID accepted")
	}
	model = old
	model.Assets = maps.Clone(old.Assets)
	asset := model.Assets["source"]
	asset.SHA256 = strings.Repeat("a", 64)
	model.Assets["source"] = asset
	if preparedNewSourceError(model, []battlemap.Model{old}) != nil || preparedNewSourceError(model, nil) == nil {
		t.Fatal("new source guard")
	}
}
