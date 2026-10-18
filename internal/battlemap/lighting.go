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

// LightOverrides stores only instance edits; unset values still follow the model template.
type LightOverrides struct {
	Effect     *LightEffect `json:"effect,omitempty"`
	Color      *string      `json:"color,omitempty"`
	Height     *float64     `json:"height,omitempty"`
	Intensity  *float64     `json:"intensity,omitempty"`
	Radius     *float64     `json:"radius,omitempty"`
	Flicker    *bool        `json:"flicker,omitempty"`
	ShowMarker *bool        `json:"showMarker,omitempty"`
	Shadows    *bool        `json:"shadows,omitempty"`
}

type Light struct {
	Effect     *LightEffect    `json:"effect,omitempty"`
	Overrides  *LightOverrides `json:"overrides,omitempty"`
	ID         string          `json:"id"`
	BuiltinKey string          `json:"builtinKey,omitempty"`
	Name       string          `json:"name"`
	Kind       string          `json:"kind"`
	Color      string          `json:"color"`
	X          float64         `json:"x"`
	Y          float64         `json:"y"`
	Elevation  float64         `json:"elevation"`
	Height     float64         `json:"height"`
	Intensity  float64         `json:"intensity"`
	Radius     float64         `json:"radius"`
	Enabled    bool            `json:"enabled"`
	ShowMarker bool            `json:"showMarker"`
	Shadows    bool            `json:"shadows"`
	Flicker    bool            `json:"flicker"`
	Offset     [2]float64      `json:"offset"`
	Anchor     *LightAnchor    `json:"anchor,omitempty"`
	AreaID     string          `json:"areaId,omitempty"`
}

func DefaultSun() *SunLight { return &SunLight{Enabled: true, Angle: 225, Elevation: 45} }
func validateLighting(d *Document, tiles, objects map[string]bool) error {
	if d.Sun == nil {
		d.Sun = DefaultSun()
	}
	manualCount := 0
	for _, l := range d.Lights {
		if l.BuiltinKey == "" {
			manualCount++
		}
	}
	if !bounded(d.Sun.Angle, 0, 360) || !bounded(d.Sun.Elevation, 10, 85) || manualCount > 32 || len(d.Lights) > (MaxTiles+1000)*8+32 {
		return fmt.Errorf("Некорректные настройки освещения")
	}
	areas := map[string]bool{}
	for _, area := range d.Areas {
		areas[area.ID] = true
	}
	ids := map[string]bool{}
	for _, light := range d.Lights {
		if light.BuiltinKey == "" && light.Overrides != nil {
			return fmt.Errorf("Параметры экземпляра допустимы только для встроенного света")
		}
		heightLimit := 16.0
		margin := 0.0
		if light.BuiltinKey != "" {
			heightLimit = 256
			margin = 128
		}
		if light.BuiltinKey != "" && (!identifier.MatchString(light.BuiltinKey) || len(light.BuiltinKey) > 32 || light.Anchor == nil) {
			return fmt.Errorf("Некорректная привязка встроенного света")
		}
		if !identifier.MatchString(light.ID) || ids[light.ID] || strings.TrimSpace(light.Name) == "" || len([]rune(light.Name)) > 100 ||
			(light.Kind != "torch" && light.Kind != "candle" && light.Kind != "magic") || !color.MatchString(light.Color) ||
			!bounded(light.X, -margin, d.Width+margin) || !bounded(light.Y, -margin, d.Height+margin) || !bounded(light.Elevation, 0, 512) ||
			!bounded(light.Height, 0, heightLimit) || !bounded(light.Intensity, 0, 50) || !bounded(light.Radius, .25, 32) ||
			!bounded(light.Offset[0], -8, 8) || !bounded(light.Offset[1], -8, 8) || (light.AreaID != "" && !areas[light.AreaID]) {
			return fmt.Errorf("Некорректный источник освещения")
		}
		if err := ValidateLightEffect(light.Effect); err != nil {
			return err
		}
		if light.Anchor != nil && !((light.Anchor.Kind == "tile" && tiles[light.Anchor.ID]) || (light.Anchor.Kind == "object" && objects[light.Anchor.ID])) {
			return fmt.Errorf("Опора источника света отсутствует")
		}
		ids[light.ID] = true
	}
	if d.Lights == nil {
		d.Lights = []Light{}
	}
	return nil
}
