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
	for _, model := range models {
		if seen[model.ID] {
			t.Errorf("duplicate model %s", model.SourceCode)
		}
		seen[model.ID] = true
		if err := validateMapModel(model); err != nil {
			t.Errorf("%s: %v", model.SourceCode, err)
		}
	}
	t.Logf("validated %d model manifests", len(models))
}
