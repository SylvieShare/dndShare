package web

import (
	"crypto/sha256"
	"dndshare/internal/battlemap"
	"encoding/json"
	"fmt"
	"sort"
)

func signMapPreviewModel(view *mapModelView) error {
	raw, err := json.Marshal(mapPreviewModels([]mapModelView{*view})[0])
	if err != nil {
		return err
	}
	view.PreviewSignature = fmt.Sprintf("%x", sha256.Sum256(raw))
	return nil
}

// The client can compare these already delivered signatures locally, without
// fetching model metadata again or duplicating the Go visual projection.
func mapPreviewModelsSignature(views []mapModelView) string {
	pairs := make([][2]string, 0, len(views))
	for _, view := range views {
		pairs = append(pairs, [2]string{view.ModelMetadata.ID, view.PreviewSignature})
	}
	sort.Slice(pairs, func(i, j int) bool { return pairs[i][0] < pairs[j][0] })
	raw, _ := json.Marshal(pairs)
	return fmt.Sprintf("%x", sha256.Sum256(raw))
}

// Hash only data used by the fixed camera capture, without changing the context
// returned to the renderer or the persisted document/catalogue.
func mapPreviewScene(d battlemap.Document) battlemap.Document {
	d.Tags, d.Zones = nil, nil
	d.Areas = append([]battlemap.Area{}, d.Areas...)
	for i := range d.Areas {
		d.Areas[i].Name, d.Areas[i].Color = "", ""
	}
	d.Lights = append([]battlemap.Light{}, d.Lights...)
	for i := range d.Lights {
		light := &d.Lights[i]
		light.Name, light.Flicker, light.ShowMarker = "", false, false
		if light.Overrides != nil {
			overrides := *light.Overrides
			overrides.Flicker, overrides.ShowMarker = nil, nil
			light.Overrides = &overrides
			if overrides == (battlemap.LightOverrides{}) {
				light.Overrides = nil
			}
		}
	}
	return d
}

func mapPreviewModels(views []mapModelView) []mapModelView {
	result := append([]mapModelView{}, views...)
	for i := range result {
		view := &result[i]
		view.AssetBytes, view.Tags = nil, nil
		view.PreviewURL = ""
		view.PreviewSignature = ""
		view.Name, view.NameEn, view.SourceName = "", "", ""
		view.Code, view.VariantCode, view.CollectionName = "", "", ""
		view.GroupName, view.GroupNameEn = "", ""
		view.Behaviour.Revision = 0
		view.Behaviour.DefaultLights = append([]battlemap.ModelLight{}, view.Behaviour.DefaultLights...)
		for j := range view.Behaviour.DefaultLights {
			view.Behaviour.DefaultLights[j].Name = ""
			view.Behaviour.DefaultLights[j].Flicker = false
		}
	}
	return result
}
