package battlemap

import (
	"fmt"
	"strings"
)

type MapFlag struct {
	ID         string       `json:"id"`
	Name       string       `json:"name"`
	Enabled    bool         `json:"enabled"`
	BuiltinKey string       `json:"builtinKey,omitempty"`
	Anchor     *LightAnchor `json:"anchor,omitempty"`
}

type ModelFlag struct {
	Key     string `json:"key"`
	Name    string `json:"name"`
	Enabled bool   `json:"enabled"`
}

type EffectOverrides struct {
	Color    *string     `json:"color,omitempty"`
	Size     *[2]float64 `json:"size,omitempty"`
	Strength *float64    `json:"strength,omitempty"`
	Height   *float64    `json:"height,omitempty"`
	FlagID   *string     `json:"flagId,omitempty"`
}

type Effect struct {
	ID         string           `json:"id"`
	Name       string           `json:"name"`
	Kind       string           `json:"kind"`
	Color      string           `json:"color"`
	Size       [2]float64       `json:"size"`
	Strength   float64          `json:"strength"`
	Enabled    bool             `json:"enabled"`
	FlagID     string           `json:"flagId,omitempty"`
	X          float64          `json:"x"`
	Y          float64          `json:"y"`
	Elevation  float64          `json:"elevation"`
	Height     float64          `json:"height"`
	Offset     [2]float64       `json:"offset"`
	Anchor     *LightAnchor     `json:"anchor,omitempty"`
	AreaID     string           `json:"areaId,omitempty"`
	BuiltinKey string           `json:"builtinKey,omitempty"`
	Overrides  *EffectOverrides `json:"overrides,omitempty"`
}

type ModelEffect struct {
	Key      string     `json:"key"`
	Name     string     `json:"name"`
	Kind     string     `json:"kind"`
	Color    string     `json:"color"`
	Size     [2]float64 `json:"size"`
	Strength float64    `json:"strength"`
	Enabled  bool       `json:"enabled"`
	Position [3]float64 `json:"position"`
	FlagKey  string     `json:"flagKey,omitempty"`
}

func validEffect(kind, colour string, size [2]float64, strength float64) bool {
	return kind == "fire" && color.MatchString(colour) && bounded(size[0], .02, 8) && bounded(size[1], .02, 16) && bounded(strength, 0, 2)
}

func validateModelComponents(b ModelBehaviour) error {
	if len(b.DefaultFlags) > 16 || len(b.DefaultEffects) > 16 {
		return fmt.Errorf("Слишком много флагов или эффектов модели")
	}
	flags, effects := map[string]bool{}, map[string]bool{}
	for _, f := range b.DefaultFlags {
		if !identifier.MatchString(f.Key) || len(f.Key) > 32 || flags[f.Key] || strings.TrimSpace(f.Name) == "" || len([]rune(f.Name)) > 100 {
			return fmt.Errorf("Некорректный флаг модели")
		}
		flags[f.Key] = true
	}
	for _, l := range b.DefaultLights {
		if l.FlagKey != "" && !flags[l.FlagKey] {
			return fmt.Errorf("Управляющий флаг света отсутствует")
		}
	}
	for _, e := range b.DefaultEffects {
		if !identifier.MatchString(e.Key) || len(e.Key) > 32 || effects[e.Key] || strings.TrimSpace(e.Name) == "" || len([]rune(e.Name)) > 100 || !validEffect(e.Kind, e.Color, e.Size, e.Strength) || !bounded(e.Position[0], -8, 8) || !bounded(e.Position[1], -8, 8) || !bounded(e.Position[2], 0, 32) || e.FlagKey != "" && !flags[e.FlagKey] {
			return fmt.Errorf("Некорректный эффект модели")
		}
		effects[e.Key] = true
	}
	return nil
}

func validateComponents(d *Document, tiles, objects map[string]bool) error {
	if len(d.Flags) > MaxTiles*16+256 || len(d.Effects) > MaxTiles*16+256 {
		return fmt.Errorf("Слишком много флагов или эффектов")
	}
	validAnchor := func(a *LightAnchor) bool {
		return a == nil || a.Kind == "tile" && tiles[a.ID] || a.Kind == "object" && objects[a.ID]
	}
	flags, effects, areas := map[string]bool{}, map[string]bool{}, map[string]bool{}
	for _, a := range d.Areas {
		areas[a.ID] = true
	}
	manualFlags, manualEffects := 0, 0
	for _, f := range d.Flags {
		if !identifier.MatchString(f.ID) || flags[f.ID] || strings.TrimSpace(f.Name) == "" || len([]rune(f.Name)) > 100 || !validAnchor(f.Anchor) || f.BuiltinKey != "" && (!identifier.MatchString(f.BuiltinKey) || f.Anchor == nil) {
			return fmt.Errorf("Некорректный флаг карты")
		}
		if f.BuiltinKey == "" {
			manualFlags++
		}
		flags[f.ID] = true
	}
	for _, l := range d.Lights {
		if l.FlagID != "" && !flags[l.FlagID] {
			return fmt.Errorf("Флаг источника света отсутствует")
		}
	}
	for _, e := range d.Effects {
		margin, height := 0.0, 16.0
		if e.BuiltinKey != "" {
			margin, height = 128, 256
		} else {
			manualEffects++
		}
		if !identifier.MatchString(e.ID) || effects[e.ID] || strings.TrimSpace(e.Name) == "" || len([]rune(e.Name)) > 100 || !validEffect(e.Kind, e.Color, e.Size, e.Strength) || !validAnchor(e.Anchor) || e.FlagID != "" && !flags[e.FlagID] || e.AreaID != "" && !areas[e.AreaID] || !bounded(e.X, -margin, d.Width+margin) || !bounded(e.Y, -margin, d.Height+margin) || !bounded(e.Elevation, 0, 512) || !bounded(e.Height, 0, height) || !bounded(e.Offset[0], -8, 8) || !bounded(e.Offset[1], -8, 8) || e.BuiltinKey == "" && e.Overrides != nil || e.BuiltinKey != "" && (!identifier.MatchString(e.BuiltinKey) || e.Anchor == nil) {
			return fmt.Errorf("Некорректный эффект карты")
		}
		effects[e.ID] = true
	}
	if manualFlags > 128 || manualEffects > 128 {
		return fmt.Errorf("Допустимо до 128 ручных флагов и эффектов")
	}
	if d.Flags == nil {
		d.Flags = []MapFlag{}
	}
	if d.Effects == nil {
		d.Effects = []Effect{}
	}
	return nil
}
