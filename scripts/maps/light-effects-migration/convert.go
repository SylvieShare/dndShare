package main

import (
	"dndshare/internal/battlemap"
	"encoding/json"
	"fmt"
	"math"
)

// Legacy fields live only in this explicit, offline data operation.
type oldFlag struct {
	ID, Key string
	Enabled bool
}
type oldLight struct {
	battlemap.Light
	FlagID string `json:"flagId"`
}
type oldModelLight struct {
	battlemap.ModelLight
	FlagKey string `json:"flagKey"`
}
type oldEffect struct {
	ID, Key, Name, Kind, Color, FlagID, FlagKey, BuiltinKey string
	Size                                                    [2]float64
	Strength                                                float64
	Enabled                                                 bool
	Position                                                [3]float64
	X, Y, Elevation, Height                                 float64
	Offset                                                  [2]float64
	Anchor                                                  *battlemap.LightAnchor
	AreaID                                                  string
}

func flagOn(flags []oldFlag, id string, template bool) bool {
	if id == "" {
		return true
	}
	for _, f := range flags {
		if (!template && f.ID == id) || (template && f.Key == id) {
			return f.Enabled
		}
	}
	panic("Missing legacy flag: " + id)
}
func sameAnchor(a, b *battlemap.LightAnchor) bool {
	return a == nil && b == nil || a != nil && b != nil && *a == *b
}
func visual(e oldEffect, offset [3]float64, enabled bool) *battlemap.LightEffect {
	kind := "fire"
	if !enabled {
		kind = "none"
	}
	return &battlemap.LightEffect{Kind: kind, Size: e.Size, Strength: e.Strength, Offset: offset}
}

func convertTemplate(lights []oldModelLight, flags []oldFlag, effects []oldEffect) ([]battlemap.ModelLight, error) {
	out := []battlemap.ModelLight{}
	used := map[int]bool{}
	for _, old := range lights {
		l := old.ModelLight
		l.Enabled = l.Enabled && flagOn(flags, old.FlagKey, true)
		for i, e := range effects {
			if used[i] || old.FlagKey == "" || old.FlagKey != e.FlagKey {
				continue
			}
			offset := [3]float64{}
			for k := range offset {
				offset[k] = e.Position[k] - l.Position[k]
			}
			l.Effect = visual(e, offset, e.Enabled)
			used[i] = true
			break
		}
		out = append(out, l)
	}
	for i, e := range effects {
		if used[i] {
			continue
		}
		out = append(out, battlemap.ModelLight{Key: e.Key, Name: e.Name, Kind: "torch", Color: e.Color, Position: e.Position, Radius: 4, Enabled: e.Enabled, Effect: visual(e, [3]float64{}, true)})
	}
	if err := battlemap.ValidateModelBehaviour(battlemap.ModelBehaviour{Revision: 1, DefaultLights: out}); err != nil {
		return nil, err
	}
	return out, nil
}

func convertDocument(raw []byte) ([]byte, error) {
	var old struct {
		battlemap.Document
		Lights  []oldLight  `json:"lights"`
		Flags   []oldFlag   `json:"flags"`
		Effects []oldEffect `json:"effects"`
	}
	if err := json.Unmarshal(raw, &old); err != nil {
		return nil, err
	}
	d := old.Document
	d.Lights = []battlemap.Light{}
	used := map[int]bool{}
	rotation := func(anchor *battlemap.LightAnchor) float64 {
		if anchor == nil {
			return 0
		}
		if anchor.Kind == "tile" {
			for _, t := range d.Tiles {
				if t.ID == anchor.ID {
					return float64(t.Rotation) * math.Pi / 180
				}
			}
		}
		for _, o := range d.Objects {
			if o.ID == anchor.ID {
				return o.Rotation * math.Pi / 180
			}
		}
		return 0
	}
	for _, src := range old.Lights {
		l := src.Light
		l.Enabled = l.Enabled && flagOn(old.Flags, src.FlagID, false)
		for i, e := range old.Effects {
			if used[i] || src.FlagID == "" || src.FlagID != e.FlagID || !sameAnchor(l.Anchor, e.Anchor) {
				continue
			}
			dx, dy := e.X-l.X, e.Y-l.Y
			a := rotation(l.Anchor)
			offset := [3]float64{dx*math.Cos(a) + dy*math.Sin(a), -dx*math.Sin(a) + dy*math.Cos(a), e.Elevation + e.Height - l.Elevation - l.Height}
			// A shared off flag belongs on the light; it must not disable its visual preset.
			on := e.Enabled
			if e.FlagID != src.FlagID {
				on = on && flagOn(old.Flags, e.FlagID, false)
			}
			l.Effect = visual(e, offset, on)
			if l.BuiltinKey != "" {
				if l.Overrides == nil {
					l.Overrides = &battlemap.LightOverrides{}
				}
				l.Overrides.Effect = l.Effect
			}
			used[i] = true
			break
		}
		d.Lights = append(d.Lights, l)
	}
	for i, e := range old.Effects {
		if used[i] {
			continue
		}
		id := e.ID
		if id == "" {
			return nil, fmt.Errorf("Effect has no ID")
		}
		// An independent visual becomes a zero-intensity light with the same anchor.
		d.Lights = append(d.Lights, battlemap.Light{ID: id, Name: e.Name, Kind: "torch", Color: e.Color, X: e.X, Y: e.Y, Elevation: e.Elevation, Height: e.Height, Offset: e.Offset, Anchor: e.Anchor, AreaID: e.AreaID, Radius: 4, Enabled: e.Enabled && flagOn(old.Flags, e.FlagID, false), Effect: visual(e, [3]float64{}, true)})
	}
	if err := battlemap.ValidateDocument(&d); err != nil {
		return nil, err
	}
	return json.Marshal(d)
}
