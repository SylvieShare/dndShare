package web

import (
	"dndshare/internal/battlemap"
	"encoding/json"
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
		if len(previous) != 0 {
			compatible := false
			for _, old := range previous {
				compatible = compatible || battlemap.VisualRevision(old, model)
			}
			if !compatible {
				t.Errorf("%s %s changes the original placement/source contract", model.SourceCode, model.SourceName)
			}
		}
	}
	t.Logf("validated %d model manifests", len(models))
}
