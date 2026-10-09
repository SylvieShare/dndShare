package battlemap

import (
	"fmt"
	"math"
	"net/url"
	"regexp"
	"strings"
)

var identifier = regexp.MustCompile(`^[a-zA-Z0-9_-]{1,80}$`)
var color = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

func bounded(n, lo, hi float64) bool {
	return !math.IsNaN(n) && !math.IsInf(n, 0) && n >= lo && n <= hi
}
func visibility(s string) bool { return s == "hidden" || s == "explored" || s == "visible" }

func ValidateDocument(d *Document) error {
	if d.Version != DocumentVersion || d.Kind != "tiles" {
		return fmt.Errorf("Неизвестный формат карты")
	}
	if !bounded(d.Width, 2, 160) || !bounded(d.Height, 2, 160) || d.Width*d.Height > 16000 {
		return fmt.Errorf("Размер карты: от 2 до 160 клеток по стороне, не более 16000 клеток")
	}
	if math.Trunc(d.Width) != d.Width || math.Trunc(d.Height) != d.Height {
		return fmt.Errorf("Размер клеточной карты должен быть целым")
	}
	if len(d.Tiles) > MaxTiles || len(d.Objects) > 1000 || len(d.Zones) > 200 {
		return fmt.Errorf("Слишком много элементов карты")
	}
	if err := validateMapTags(d); err != nil {
		return err
	}
	tileIDs := map[string]bool{}
	for _, tile := range d.Tiles {
		if !identifier.MatchString(tile.ID) || tileIDs[tile.ID] || !modelIdentifier.MatchString(tile.ModelID) ||
			tile.X < 0 || tile.Y < 0 || float64(tile.X) >= d.Width || float64(tile.Y) >= d.Height ||
			tile.Level < 0 || tile.Level > 15 || (tile.Rotation != 0 && tile.Rotation != 90 && tile.Rotation != 180 && tile.Rotation != 270) {
			return fmt.Errorf("Некорректная плитка карты")
		}
		tileIDs[tile.ID] = true
	}
	ids := map[string]bool{}
	for _, object := range d.Objects {
		if !identifier.MatchString(object.ID) || ids[object.ID] || !ObjectKinds[object.Kind] || !bounded(object.X, 0, d.Width) || !bounded(object.Y, 0, d.Height) || !bounded(object.Scale, .25, 8) || !bounded(object.Rotation, -360, 360) {
			return fmt.Errorf("Некорректный объект карты")
		}
		if object.ModelID != "" && !modelIdentifier.MatchString(object.ModelID) {
			return fmt.Errorf("Некорректная модель объекта")
		}
		if object.Placement != nil && (!tileIDs[object.Placement.TileID] || object.Placement.Point < 0 || object.Placement.Point >= 256) {
			return fmt.Errorf("Некорректная точка объекта")
		}
		ids[object.ID] = true
	}
	if err := validateAreas(d, tileIDs, ids); err != nil {
		return err
	}
	if err := validateLighting(d, tileIDs, ids); err != nil {
		return err
	}
	ids = map[string]bool{}
	totalCells := 0
	for _, zone := range d.Zones {
		totalCells += len(zone.Cells)
		if !identifier.MatchString(zone.ID) || ids[zone.ID] || len([]rune(zone.Name)) > 100 || len(zone.Rects) > 100 || totalCells > 64000 {
			return fmt.Errorf("Некорректная зона карты")
		}
		ids[zone.ID] = true
		for _, cell := range zone.Cells {
			if cell < 0 || cell >= int(math.Ceil(d.Width)*math.Ceil(d.Height)) {
				return fmt.Errorf("Клетка зоны вне карты")
			}
		}
		for _, r := range zone.Rects {
			if !bounded(r.X, 0, d.Width) || !bounded(r.Y, 0, d.Height) || !bounded(r.Width, .01, d.Width-r.X+.001) || !bounded(r.Height, .01, d.Height-r.Y+.001) {
				return fmt.Errorf("Область зоны вне карты")
			}
		}
	}
	if d.Tiles == nil {
		d.Tiles = []Tile{}
	}
	if d.Objects == nil {
		d.Objects = []Object{}
	}
	if d.Zones == nil {
		d.Zones = []Zone{}
	}
	return nil
}

func ValidateState(s *State, d Document) error {
	if !visibility(s.DefaultVisibility) || len(s.Tokens) > 250 {
		return fmt.Errorf("Некорректное состояние карты")
	}
	zones := map[string]bool{}
	objects := map[string]bool{}
	for _, z := range d.Zones {
		zones[z.ID] = true
	}
	for _, o := range d.Objects {
		if Interactive(o.Kind) {
			objects[o.ID] = true
		}
	}
	for id, value := range s.Zones {
		if !zones[id] || !visibility(value) {
			return fmt.Errorf("Неизвестная зона")
		}
	}
	for id := range s.Objects {
		if !objects[id] {
			return fmt.Errorf("Объект не поддерживает взаимодействие")
		}
	}
	ids := map[string]bool{}
	for _, t := range s.Tokens {
		if !identifier.MatchString(t.ID) || ids[t.ID] || (t.Kind != "player" && t.Kind != "creature" && t.Kind != "marker") || len(t.Ref) > 100 || len([]rune(t.Name)) > 100 || !color.MatchString(t.Color) || !bounded(t.Size, .5, 8) || !bounded(t.X, 0, d.Width) || !bounded(t.Y, 0, d.Height) || !SafeURL(t.ImageURL) {
			return fmt.Errorf("Некорректный жетон")
		}
		ids[t.ID] = true
	}
	if s.Tokens == nil {
		s.Tokens = []Token{}
	}
	if s.Zones == nil {
		s.Zones = map[string]string{}
	}
	if s.Objects == nil {
		s.Objects = map[string]bool{}
	}
	return nil
}

func ValidateCamera(c Camera) bool {
	return bounded(c.X, -160, 320) && bounded(c.Y, -160, 320) && bounded(c.CellPixels, 8, 400) && (c.Rotation == 0 || c.Rotation == 90 || c.Rotation == 180 || c.Rotation == 270)
}

func SafeURL(raw string) bool {
	if raw == "" {
		return true
	}
	if len(raw) > 2048 || strings.ContainsAny(raw, "\r\n\\") {
		return false
	}
	if strings.HasPrefix(raw, "/") && !strings.HasPrefix(raw, "//") {
		return true
	}
	u, err := url.Parse(raw)
	return err == nil && (u.Scheme == "https" || u.Scheme == "http") && u.Host != "" && u.User == nil
}
