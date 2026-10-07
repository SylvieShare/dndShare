package battlemap

import (
	"crypto/sha256"
	"fmt"
	"math"
)

// Templates belong to logical models; enabled state belongs to placed instances.
// Rebuild all other fields so a supplied builtinKey cannot evade manual-light limits.
func SyncBuiltinLights(d *Document, models map[string]ModelMetadata, behaviours map[string]ModelBehaviour) error {
	poses, err := ResolveTilePlacements(*d, models)
	if err != nil {
		return err
	}
	type owner struct {
		kind, id                    string
		model                       ModelMetadata
		x, y, base, rotation, scale float64
	}
	owners := []owner{}
	for _, t := range d.Tiles {
		owners = append(owners, owner{"tile", t.ID, models[t.ModelID], float64(t.X), float64(t.Y), poses[t.ID].Elevation, float64(t.Rotation), 1})
	}
	for _, o := range d.Objects {
		base := .44
		if o.Placement != nil {
			for _, t := range d.Tiles {
				if t.ID == o.Placement.TileID {
					m := models[t.ModelID]
					if o.Placement.Point < 0 || o.Placement.Point >= len(m.PlacementPoints) {
						return fmt.Errorf("Точка размещения объекта отсутствует")
					}
					_, _, base = SurfacePosition(t, m, m.PlacementPoints[o.Placement.Point], poses[t.ID].Elevation)
				}
			}
		}
		owners = append(owners, owner{"object", o.ID, models[o.ModelID], o.X, o.Y, base, o.Rotation, o.Scale})
	}
	previous := map[string]Light{}
	manual := []Light{}
	key := func(a LightAnchor, k string) string { return a.Kind + ":" + a.ID + ":" + k }
	for _, l := range d.Lights {
		if l.BuiltinKey == "" {
			manual = append(manual, l)
			continue
		}
		if l.Anchor == nil {
			return fmt.Errorf("У встроенного света отсутствует модель")
		}
		k := key(*l.Anchor, l.BuiltinKey)
		if _, duplicate := previous[k]; duplicate {
			return fmt.Errorf("Повторяющийся встроенный источник")
		}
		previous[k] = l
	}
	for _, o := range owners {
		for _, template := range behaviours[o.model.DefinitionID].DefaultLights {
			anchor := LightAnchor{o.kind, o.id}
			k := key(anchor, template.Key)
			old, exists := previous[k]
			delete(previous, k)
			id := old.ID
			if !exists {
				id = fmt.Sprintf("builtin-%x", sha256.Sum256([]byte(k)))[:39]
			}
			enabled := template.Enabled
			if exists {
				enabled = old.Enabled
			}
			x, y := template.Position[0], template.Position[1]
			if o.kind == "tile" {
				x += o.model.PlacementOffset[0]
				y += o.model.PlacementOffset[1]
				x, y, _ = SurfacePosition(Tile{X: int(o.x), Y: int(o.y), Rotation: int(o.rotation)}, o.model, PlacementPoint{X: x, Y: y}, 0)
			} else {
				x = (x - float64(o.model.Width)/2) * o.scale
				y = (y - float64(o.model.Height)/2) * o.scale
				a := o.rotation * math.Pi / 180
				x, y = o.x+x*math.Cos(a)-y*math.Sin(a), o.y+x*math.Sin(a)+y*math.Cos(a)
			}
			manual = append(manual, Light{ID: id, BuiltinKey: template.Key, Name: template.Name, Kind: template.Kind, Color: template.Color,
				X: x, Y: y, Elevation: o.base, Height: template.Position[2] * o.scale, Intensity: template.Intensity, Radius: template.Radius,
				Enabled: enabled, Flicker: template.Flicker, Offset: [2]float64{}, Anchor: &anchor})
		}
	}
	if len(previous) > 0 {
		return fmt.Errorf("Источник не принадлежит встроенному освещению модели")
	}
	d.Lights = manual
	return nil
}
