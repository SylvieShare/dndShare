package battlemap

import (
	"fmt"
	"math"
)

// Surface coordinates are local footprint cells; elevations include mounting depth.
func SurfacePosition(tile Tile, model ModelMetadata, point PlacementPoint, elevation float64) (float64, float64, float64) {
	x, y := point.X, point.Y
	switch tile.Rotation {
	case 90:
		x, y = float64(model.Height)-y, x
	case 180:
		x, y = float64(model.Width)-x, float64(model.Height)-y
	case 270:
		x, y = y, float64(model.Width)-x
	}
	return float64(tile.X) + x, float64(tile.Y) + y, elevation + point.Elevation - model.MountDepth
}

func ValidateSurfaceAnchor(d Document, models map[string]ModelMetadata, anchor *PlacementAnchor, x, y float64) error {
	if anchor == nil {
		return nil
	}
	for _, tile := range d.Tiles {
		if tile.ID != anchor.TileID {
			continue
		}
		model, ok := models[tile.ModelID]
		if !ok || !model.CanStand || anchor.Point < 0 || anchor.Point >= len(model.PlacementPoints) {
			return fmt.Errorf("На этой точке нельзя размещать предметы или персонажей")
		}
		px, py, _ := SurfacePosition(tile, model, model.PlacementPoints[anchor.Point], 0)
		if math.Abs(px-x) > .001 || math.Abs(py-y) > .001 {
			return fmt.Errorf("Положение не совпадает с точкой тайла")
		}
		return nil
	}
	return fmt.Errorf("Опорный тайл для размещения отсутствует")
}

func ValidateObjectModels(d Document, models map[string]ModelMetadata) error {
	occupied := map[PlacementAnchor]bool{}
	for _, object := range d.Objects {
		if object.ModelID == "" {
			continue
		}
		model, ok := models[object.ModelID]
		if !ok || model.TileType != "object" {
			return fmt.Errorf("Модель объекта отсутствует в каталоге")
		}
		if d.Kind == "tiles" && object.Placement == nil {
			return fmt.Errorf("Для объекта нужна точка размещения на тайле")
		}
		if err := ValidateSurfaceAnchor(d, models, object.Placement, object.X, object.Y); err != nil {
			return err
		}
		if object.Placement != nil {
			if occupied[*object.Placement] {
				return fmt.Errorf("Точка размещения занята другим объектом")
			}
			occupied[*object.Placement] = true
		}
	}
	return nil
}
