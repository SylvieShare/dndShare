package battlemap

import (
	"fmt"
	"math"
	"sort"
)

type TilePlacement struct {
	Elevation float64
	Supports  []string
}

type supportCell struct {
	elevation      float64
	insertionRise  float64
	insertionRises map[string]float64
	parent         string
}

func RotatedSupportSlot(slot SupportSlot, model ModelMetadata, rotation int) SupportSlot {
	switch rotation {
	case 90:
		slot.X, slot.Y, slot.Width, slot.Height = model.Height-slot.Y-slot.Height, slot.X, slot.Height, slot.Width
	case 180:
		slot.X, slot.Y = model.Width-slot.X-slot.Width, model.Height-slot.Y-slot.Height
	case 270:
		slot.X, slot.Y, slot.Width, slot.Height = slot.Y, model.Width-slot.X-slot.Width, slot.Height, slot.Width
	}
	return slot
}

// One socket cell can support an overhang. The highest sockets define the plane.
func ResolveTilePlacements(d Document, models map[string]ModelMetadata) (map[string]TilePlacement, error) {
	result := map[string]TilePlacement{}
	occupied := map[[3]int]bool{}
	sockets := map[[3]int]supportCell{}
	tiles := append([]Tile(nil), d.Tiles...)
	sort.SliceStable(tiles, func(i, j int) bool { return tiles[i].Level < tiles[j].Level })
	for _, tile := range tiles {
		model, ok := models[tile.ModelID]
		if !ok || model.TileType == "object" {
			return nil, fmt.Errorf("Модель плитки отсутствует в каталоге")
		}
		width, height := TileFootprint(tile, model)
		if tile.X < 0 || tile.Y < 0 || tile.X+width > int(d.Width) || tile.Y+height > int(d.Height) {
			return nil, fmt.Errorf("Плитка выходит за границу карты")
		}
		placement := TilePlacement{Supports: []string{}}
		supports := []supportCell{}
		for y := tile.Y; y < tile.Y+height; y++ {
			for x := tile.X; x < tile.X+width; x++ {
				key := [3]int{x, y, tile.Level}
				if occupied[key] {
					return nil, fmt.Errorf("Плитки на одном уровне не должны перекрываться")
				}
				if tile.Level > 0 {
					socket, ok := sockets[key]
					if ok {
						if model.MountDepth > 0 {
							rise := socket.insertionRise
							if measured, ok := socket.insertionRises[model.MountProfile]; ok {
								rise = measured
							}
							socket.elevation += rise
						}
						supports = append(supports, socket)
						placement.Elevation = math.Max(placement.Elevation, socket.elevation)
					}
				}
				occupied[key] = true
			}
		}
		if tile.Level > 0 && len(supports) == 0 {
			return nil, fmt.Errorf("Для верхнего уровня нужен опорный слот хотя бы под одной клеткой плитки")
		}
		seen := map[string]bool{}
		for _, socket := range supports {
			if math.Abs(socket.elevation-placement.Elevation) <= .015 && !seen[socket.parent] {
				placement.Supports = append(placement.Supports, socket.parent)
				seen[socket.parent] = true
			}
		}
		result[tile.ID] = placement
		for _, raw := range model.SupportSlots {
			slot := RotatedSupportSlot(raw, model, tile.Rotation)
			for y := slot.Y; y < slot.Y+slot.Height; y++ {
				for x := slot.X; x < slot.X+slot.Width; x++ {
					sockets[[3]int{tile.X + x, tile.Y + y, tile.Level + 1}] = supportCell{elevation: placement.Elevation + slot.Elevation - model.MountDepth, insertionRise: slot.InsertionRise, insertionRises: slot.InsertionRises, parent: tile.ID}
				}
			}
		}
	}
	return result, nil
}
