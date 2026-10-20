package web

import "dndshare/internal/battlemap"

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
