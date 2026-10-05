package store

import (
	"encoding/json"
	"testing"

	"dndshare/internal/battlemap"
)

func TestMapModelTextureDetailPersistsInMetadataJSON(t *testing.T) {
	for _, level := range []string{"basic", "detailed"} {
		model := battlemap.InitialCatalogue()[0]
		model.TextureDetail = level
		geometry, _, err := marshalMapModel(model)
		if err != nil {
			t.Fatal(err)
		}
		var restored battlemap.ModelMetadata
		if err := json.Unmarshal(geometry, &restored); err != nil || restored.TextureDetail != level {
			t.Fatalf("texture detail readback: %+v %v", restored, err)
		}
	}
}
