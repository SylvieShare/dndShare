package battlemap

import (
	"fmt"
	"math"
)

func tokenSpan(token Token) int      { return int(math.Max(1, math.Ceil(token.Size))) }
func occupiesCells(token Token) bool { return token.Kind == "player" || token.Kind == "creature" }

func TokenAnchorOffset(token Token, point PlacementPoint, tile Tile) [2]float64 {
	if !occupiesCells(token) {
		return [2]float64{}
	}
	if token.AnchorOffset != nil {
		return *token.AnchorOffset
	}
	span := tokenSpan(token)
	if span > 1 && point.Cell != nil {
		dx, dy := float64(span-1)/2, float64(span-1)/2
		switch tile.Rotation {
		case 90:
			dx, dy = dy, -dx
		case 180:
			dx, dy = -dx, -dy
		case 270:
			dx, dy = -dy, dx
		}
		if tile.Mirrored {
			dx = -dx
		}
		return [2]float64{float64(point.Cell.X) + .5 - point.X + dx, float64(point.Cell.Y) + .5 - point.Y + dy}
	}
	return [2]float64{}
}

type tokenRectangle struct {
	x, y, span int
	elevation  float64
}

// Validate the complete occupied area. Coordinates are canonicalized from the
// standing anchor, so tile edits and old multi-cell placements share one centre.
func ValidateTokenPlacements(d Document, state *State, models map[string]ModelMetadata) error {
	poses, err := ResolveTilePlacements(d, models)
	if err != nil {
		return err
	}
	tiles := map[string]Tile{}
	cells := map[GridCell][]float64{}
	occupied := map[PlacementAnchor]bool{}
	for _, object := range d.Objects {
		if object.Placement != nil {
			occupied[*object.Placement] = true
		}
	}
	for _, tile := range d.Tiles {
		tiles[tile.ID] = tile
		model := models[tile.ModelID]
		if !model.CanStand {
			continue
		}
		for index, point := range model.PlacementPoints {
			if point.Cell == nil || occupied[PlacementAnchor{TileID: tile.ID, Point: index}] {
				continue
			}
			cell := SurfaceCell(tile, model, point)
			_, _, elevation := SurfacePosition(tile, model, point, poses[tile.ID].Elevation)
			cells[cell] = append(cells[cell], elevation)
		}
	}
	rectangles := []tokenRectangle{}
	for i := range state.Tokens {
		token := &state.Tokens[i]
		if !occupiesCells(*token) {
			if err := ValidateSurfaceAnchor(d, models, token.Placement, token.X, token.Y); err != nil {
				return err
			}
			continue
		}
		span, elevation := tokenSpan(*token), .44
		var anchorCell *GridCell
		if token.Placement != nil {
			tile, found := tiles[token.Placement.TileID]
			model := models[tile.ModelID]
			if !found || !model.CanStand || token.Placement.Point < 0 || token.Placement.Point >= len(model.PlacementPoints) {
				return fmt.Errorf("На этой точке нельзя размещать существо")
			}
			if occupied[*token.Placement] {
				return fmt.Errorf("Точка размещения занята объектом")
			}
			point := model.PlacementPoints[token.Placement.Point]
			if point.Cell == nil {
				return fmt.Errorf("У опоры отсутствует клетка размещения")
			}
			cell := SurfaceCell(tile, model, point)
			anchorCell = &cell
			offset := TokenAnchorOffset(*token, point, tile)
			if span > 1 {
				token.AnchorOffset = &offset
			}
			for _, value := range offset {
				if math.IsNaN(value) || math.IsInf(value, 0) || math.Abs(value) > 9 || span == 1 && math.Abs(value) > .001 {
					return fmt.Errorf("Некорректное смещение существа относительно опоры")
				}
			}
			point.X += offset[0]
			point.Y += offset[1]
			token.X, token.Y, elevation = SurfacePosition(tile, model, point, poses[tile.ID].Elevation)
		} else if token.AnchorOffset != nil {
			return fmt.Errorf("Смещение существа требует опорного тайла")
		} else if span > 1 {
			token.X = math.Floor(token.X-float64(span)/2+.5) + float64(span)/2
			token.Y = math.Floor(token.Y-float64(span)/2+.5) + float64(span)/2
		}
		x, y := math.Floor(token.X), math.Floor(token.Y)
		if span == 1 && anchorCell != nil {
			x, y = float64(anchorCell.X), float64(anchorCell.Y)
		}
		if span > 1 {
			x, y = token.X-float64(span)/2, token.Y-float64(span)/2
			if math.Abs(x-math.Round(x)) > .001 || math.Abs(y-math.Round(y)) > .001 {
				return fmt.Errorf("Существо должно находиться в центре занимаемых клеток")
			}
			x, y = math.Round(x), math.Round(y)
		}
		if x < 0 || y < 0 || x+float64(span) > d.Width || y+float64(span) > d.Height {
			return fmt.Errorf("Существо выходит за границы карты")
		}
		if anchorCell != nil && (float64(anchorCell.X) < x || float64(anchorCell.X) >= x+float64(span) || float64(anchorCell.Y) < y || float64(anchorCell.Y) >= y+float64(span)) {
			return fmt.Errorf("Опорная клетка должна входить в площадь существа")
		}
		if d.Kind == "tiles" && span > 1 {
			for dy := 0; dy < span; dy++ {
				for dx := 0; dx < span; dx++ {
					found := false
					for _, height := range cells[GridCell{X: int(x) + dx, Y: int(y) + dy}] {
						if math.Abs(height-elevation) <= .02 {
							found = true
							break
						}
					}
					if !found {
						return fmt.Errorf("Для всей площади существа нужна опора на одной высоте")
					}
				}
			}
		}
		current := tokenRectangle{int(x), int(y), span, elevation}
		for _, other := range rectangles {
			if math.Abs(other.elevation-elevation) <= .05 && current.x < other.x+other.span && current.x+span > other.x && current.y < other.y+other.span && current.y+span > other.y {
				return fmt.Errorf("Клетки заняты другим существом")
			}
		}
		rectangles = append(rectangles, current)
	}
	return nil
}
