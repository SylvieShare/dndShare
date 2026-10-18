package battlemap

import "fmt"

const MaxTileTransitions = 32

func validateTileTransitions(value *TileTransitions) error {
	if value == nil {
		return nil
	}
	if !modelIdentifier.MatchString(value.OriginalModelID) || len(value.Targets) > MaxTileTransitions {
		return fmt.Errorf("Некорректные переходы плитки")
	}
	ids, models := map[string]bool{}, map[string]bool{}
	for _, target := range value.Targets {
		if !identifier.MatchString(target.ID) || ids[target.ID] ||
			(target.ModelID != "" && (!modelIdentifier.MatchString(target.ModelID) || models[target.ModelID])) {
			return fmt.Errorf("Некорректный переход плитки")
		}
		ids[target.ID] = true
		if target.ModelID != "" {
			models[target.ModelID] = true
		}
	}
	if value.Targets == nil {
		value.Targets = []TileTransition{}
	}
	return nil
}

// Target models remain referenced even when no placed tile currently uses them.
func TileModelReferences(tile Tile) []string {
	ids := []string{tile.ModelID}
	if tile.Transitions != nil {
		ids = append(ids, tile.Transitions.OriginalModelID)
		for _, target := range tile.Transitions.Targets {
			if target.ModelID != "" {
				ids = append(ids, target.ModelID)
			}
		}
	}
	return ids
}

func validateTransitionModels(d Document, models map[string]ModelMetadata) error {
	for _, tile := range d.Tiles {
		for _, id := range TileModelReferences(tile) {
			if model, ok := models[id]; !ok || model.TileType == "object" {
				return fmt.Errorf("Модель перехода плитки отсутствует в каталоге")
			}
		}
	}
	return nil
}
