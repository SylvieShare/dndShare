package battlemap

import (
	"crypto/sha256"
	"fmt"
	"math"
)

type componentOwner struct {
	kind, id                    string
	model                       ModelMetadata
	x, y, base, rotation, scale float64
}

func componentKey(a LightAnchor, key string) string { return a.Kind + ":" + a.ID + ":" + key }
func componentID(kind, key string) string {
	return fmt.Sprintf("%s-%x", kind, sha256.Sum256([]byte(key)))[:39]
}

func modelComponentOwners(d *Document, models map[string]ModelMetadata) ([]componentOwner, error) {
	poses, err := ResolveTilePlacements(*d, models)
	if err != nil {
		return nil, err
	}
	owners := []componentOwner{}
	for _, t := range d.Tiles {
		owners = append(owners, componentOwner{"tile", t.ID, models[t.ModelID], float64(t.X), float64(t.Y), poses[t.ID].Elevation, float64(t.Rotation), 1})
	}
	for _, o := range d.Objects {
		base := .44
		if o.Placement != nil {
			for _, t := range d.Tiles {
				if t.ID != o.Placement.TileID {
					continue
				}
				m := models[t.ModelID]
				if o.Placement.Point < 0 || o.Placement.Point >= len(m.PlacementPoints) {
					return nil, fmt.Errorf("Точка размещения объекта отсутствует")
				}
				_, _, base = SurfacePosition(t, m, m.PlacementPoints[o.Placement.Point], poses[t.ID].Elevation)
			}
		}
		owners = append(owners, componentOwner{"object", o.ID, models[o.ModelID], o.X, o.Y, base, o.Rotation, o.Scale})
	}
	return owners, nil
}

func componentFlagID(d *Document, anchor LightAnchor, key string) string {
	if key == "" {
		return ""
	}
	for _, f := range d.Flags {
		if f.BuiltinKey == key && f.Anchor != nil && *f.Anchor == anchor {
			return f.ID
		}
	}
	return ""
}

func syncBuiltinFlags(d *Document, owners []componentOwner, behaviours map[string]ModelBehaviour) error {
	previous := map[string]MapFlag{}
	result := []MapFlag{}
	for _, f := range d.Flags {
		if f.BuiltinKey == "" {
			result = append(result, f)
			continue
		}
		if f.Anchor == nil {
			return fmt.Errorf("У встроенного флага отсутствует модель")
		}
		key := componentKey(*f.Anchor, f.BuiltinKey)
		if _, exists := previous[key]; exists {
			return fmt.Errorf("Повторяющийся встроенный флаг")
		}
		previous[key] = f
	}
	for _, o := range owners {
		for _, t := range behaviours[o.model.DefinitionID].DefaultFlags {
			anchor := LightAnchor{o.kind, o.id}
			key := componentKey(anchor, t.Key)
			old, exists := previous[key]
			delete(previous, key)
			f := MapFlag{ID: componentID("flag", key), Name: t.Name, Enabled: t.Enabled, BuiltinKey: t.Key, Anchor: &anchor}
			if exists {
				f.ID = old.ID
				f.Enabled = old.Enabled
				f.Name = old.Name
			}
			result = append(result, f)
		}
	}
	if len(previous) > 0 {
		return fmt.Errorf("Флаг не принадлежит модели")
	}
	d.Flags = result
	return nil
}

func syncBuiltinEffects(d *Document, owners []componentOwner, behaviours map[string]ModelBehaviour) error {
	previous := map[string]Effect{}
	result := []Effect{}
	for _, e := range d.Effects {
		if e.BuiltinKey == "" {
			result = append(result, e)
			continue
		}
		if e.Anchor == nil {
			return fmt.Errorf("У встроенного эффекта отсутствует модель")
		}
		key := componentKey(*e.Anchor, e.BuiltinKey)
		if _, exists := previous[key]; exists {
			return fmt.Errorf("Повторяющийся встроенный эффект")
		}
		previous[key] = e
	}
	for _, o := range owners {
		for _, t := range behaviours[o.model.DefinitionID].DefaultEffects {
			anchor := LightAnchor{o.kind, o.id}
			key := componentKey(anchor, t.Key)
			old, exists := previous[key]
			delete(previous, key)
			x, y := t.Position[0], t.Position[1]
			if o.kind == "tile" {
				x, y, _ = SurfacePosition(Tile{X: int(o.x), Y: int(o.y), Rotation: int(o.rotation)}, o.model, PlacementPoint{X: x + o.model.PlacementOffset[0], Y: y + o.model.PlacementOffset[1]}, 0)
			} else {
				x = (x - float64(o.model.Width)/2) * o.scale
				y = (y - float64(o.model.Height)/2) * o.scale
				a := o.rotation * math.Pi / 180
				x, y = o.x+x*math.Cos(a)-y*math.Sin(a), o.y+x*math.Sin(a)+y*math.Cos(a)
			}
			e := Effect{ID: componentID("effect", key), Name: t.Name, Kind: t.Kind, Color: t.Color, Size: [2]float64{t.Size[0] * o.scale, t.Size[1] * o.scale}, Strength: t.Strength, Enabled: t.Enabled, FlagID: componentFlagID(d, anchor, t.FlagKey), X: x, Y: y, Elevation: o.base, Height: t.Position[2] * o.scale, Anchor: &anchor, BuiltinKey: t.Key, Overrides: old.Overrides}
			if exists {
				e.ID = old.ID
				e.Enabled = old.Enabled
			}
			if v := e.Overrides; v != nil {
				if v.Color != nil {
					e.Color = *v.Color
				}
				if v.Size != nil {
					e.Size = *v.Size
				}
				if v.Strength != nil {
					e.Strength = *v.Strength
				}
				if v.Height != nil {
					e.Height = *v.Height
				}
				if v.FlagID != nil {
					e.FlagID = *v.FlagID
				}
			}
			result = append(result, e)
		}
	}
	if len(previous) > 0 {
		return fmt.Errorf("Эффект не принадлежит модели")
	}
	d.Effects = result
	return nil
}

// Reading follows the current template catalogue; deleted template components
// are removed, while saving still rejects forged built-in keys.
func PruneBuiltinComponents(d *Document, models map[string]ModelMetadata, behaviours map[string]ModelBehaviour) {
	expected := map[string]bool{}
	add := func(kind, id, modelID string) {
		b := behaviours[models[modelID].DefinitionID]
		a := LightAnchor{kind, id}
		for _, f := range b.DefaultFlags {
			expected["flag:"+componentKey(a, f.Key)] = true
		}
		for _, e := range b.DefaultEffects {
			expected["effect:"+componentKey(a, e.Key)] = true
		}
	}
	for _, t := range d.Tiles {
		add("tile", t.ID, t.ModelID)
	}
	for _, o := range d.Objects {
		add("object", o.ID, o.ModelID)
	}
	flags := []MapFlag{}
	effects := []Effect{}
	for _, f := range d.Flags {
		if f.BuiltinKey == "" || f.Anchor != nil && expected["flag:"+componentKey(*f.Anchor, f.BuiltinKey)] {
			flags = append(flags, f)
		}
	}
	for _, e := range d.Effects {
		if e.BuiltinKey == "" || e.Anchor != nil && expected["effect:"+componentKey(*e.Anchor, e.BuiltinKey)] {
			effects = append(effects, e)
		}
	}
	d.Flags = flags
	d.Effects = effects
}
