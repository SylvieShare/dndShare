package battlemap

import (
	"crypto/sha256"
	"fmt"
	"math"
)

// Templates own identity, attachment and defaults. Explicit instance overrides
// customize light settings; an unknown builtinKey can never create another source.
func SyncBuiltinLights(d *Document, models map[string]ModelMetadata, behaviours map[string]ModelBehaviour) error {
	owners, err := modelComponentOwners(d, models)
	if err != nil {
		return err
	}
	if err = syncBuiltinFlags(d, owners, behaviours); err != nil {
		return err
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
			light := Light{ID: id, BuiltinKey: template.Key, Name: template.Name, Kind: template.Kind, Color: template.Color,
				X: x, Y: y, Elevation: o.base, Height: template.Position[2] * o.scale, Intensity: template.Intensity, Radius: template.Radius,
				Enabled: enabled, Flicker: template.Flicker, Offset: [2]float64{}, Anchor: &anchor, Overrides: old.Overrides, FlagID: componentFlagID(d, anchor, template.FlagKey)}
			applyLightOverrides(&light)
			manual = append(manual, light)
		}
	}
	if len(previous) > 0 {
		return fmt.Errorf("Источник не принадлежит встроенному освещению модели")
	}
	for i := range manual {
		if manual[i].Anchor != nil {
			manual[i].AreaID = ""
		}
	}
	d.Lights = manual
	return syncBuiltinEffects(d, owners, behaviours)
}

func applyLightOverrides(light *Light) {
	o := light.Overrides
	if o == nil {
		return
	}
	if o.FlagID != nil {
		light.FlagID = *o.FlagID
	}
	if o.Color != nil {
		light.Color = *o.Color
	}
	if o.Height != nil {
		light.Height = *o.Height
	}
	if o.Intensity != nil {
		light.Intensity = *o.Intensity
	}
	if o.Radius != nil {
		light.Radius = *o.Radius
	}
	if o.Flicker != nil {
		light.Flicker = *o.Flicker
	}
	if o.ShowMarker != nil {
		light.ShowMarker = *o.ShowMarker
	}
	if o.Shadows != nil {
		light.Shadows = *o.Shadows
	}
}
