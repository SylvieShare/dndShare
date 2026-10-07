package battlemap

import "reflect"

// VisualRevision preserves every placement/collision contract and the source STL.
// A different shape or differently named variant must remain a separate model.
func VisualRevision(original, revision Model) bool {
	if revision.Version <= original.Version || original.Assets["source"].SHA256 == "" ||
		original.Assets["source"].SHA256 != revision.Assets["source"].SHA256 {
		return false
	}
	a, b := original.ModelMetadata, revision.ModelMetadata
	a.ID, b.ID = "", ""
	a.Version, b.Version = 0, 0
	// Texture workmanship describes the visual asset, not its placement contract.
	a.TextureDetail, b.TextureDetail = "", ""
	// Group membership is shared by all versions of a logical element.
	a.Code, b.Code = "", ""
	return reflect.DeepEqual(a, b)
}

// LatestVisualModels maps immutable IDs to their newest compatible presentation.
func LatestVisualModels(models []Model) map[string]Model {
	type family struct{ collection, code, name, source string }
	families := map[family][]Model{}
	for _, model := range models {
		key := family{model.Collection, model.SourceCode, model.SourceName, model.Assets["source"].SHA256}
		families[key] = append(families[key], model)
	}
	result := make(map[string]Model, len(models))
	for _, variants := range families {
		for _, model := range variants {
			latest := model
			for _, revision := range variants {
				if revision.Version > latest.Version && VisualRevision(model, revision) {
					latest = revision
				}
			}
			result[model.ID] = latest
		}
	}
	return result
}
