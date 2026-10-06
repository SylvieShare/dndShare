package battlemap

import (
	"fmt"
	"strings"
)

type SunLight struct {
	Enabled   bool    `json:"enabled"`
	Angle     float64 `json:"angle"`
	Elevation float64 `json:"elevation"`
}
type LightAnchor struct {
	Kind string `json:"kind"`
	ID   string `json:"id"`
}
type Light struct {
	ID        string       `json:"id"`
	Name      string       `json:"name"`
	Kind      string       `json:"kind"`
	Color     string       `json:"color"`
	X         float64      `json:"x"`
	Y         float64      `json:"y"`
	Elevation float64      `json:"elevation"`
	Height    float64      `json:"height"`
	Intensity float64      `json:"intensity"`
	Radius    float64      `json:"radius"`
	Enabled   bool         `json:"enabled"`
	Shadows   bool         `json:"shadows"`
	Flicker   bool         `json:"flicker"`
	Offset    [2]float64   `json:"offset"`
	Anchor    *LightAnchor `json:"anchor,omitempty"`
	AreaID    string       `json:"areaId,omitempty"`
}

func DefaultSun() *SunLight { return &SunLight{Enabled: true, Angle: 225, Elevation: 45} }
func validateLighting(d *Document, tiles, objects map[string]bool) error {
	if d.Sun == nil {
		d.Sun = DefaultSun()
	}
	if !bounded(d.Sun.Angle, 0, 360) || !bounded(d.Sun.Elevation, 10, 85) || len(d.Lights) > 32 {
		return fmt.Errorf("Некорректные настройки освещения")
	}
	areas := map[string]bool{}
	for _, area := range d.Areas {
		areas[area.ID] = true
	}
	ids := map[string]bool{}
	shadows := 0
	for _, light := range d.Lights {
		if !identifier.MatchString(light.ID) || ids[light.ID] || strings.TrimSpace(light.Name) == "" || len([]rune(light.Name)) > 100 ||
			(light.Kind != "torch" && light.Kind != "candle" && light.Kind != "magic") || !color.MatchString(light.Color) ||
			!bounded(light.X, 0, d.Width) || !bounded(light.Y, 0, d.Height) || !bounded(light.Elevation, 0, 512) ||
			!bounded(light.Height, 0, 16) || !bounded(light.Intensity, 0, 50) || !bounded(light.Radius, .25, 32) ||
			!bounded(light.Offset[0], -8, 8) || !bounded(light.Offset[1], -8, 8) || (light.AreaID != "" && !areas[light.AreaID]) {
			return fmt.Errorf("Некорректный источник освещения")
		}
		if light.Anchor != nil && !((light.Anchor.Kind == "tile" && tiles[light.Anchor.ID]) || (light.Anchor.Kind == "object" && objects[light.Anchor.ID])) {
			return fmt.Errorf("Опора источника света отсутствует")
		}
		if light.Enabled && light.Shadows {
			shadows++
		}
		ids[light.ID] = true
	}
	if shadows > 2 {
		return fmt.Errorf("Тени могут создавать не более двух локальных источников")
	}
	if d.Lights == nil {
		d.Lights = []Light{}
	}
	return nil
}
