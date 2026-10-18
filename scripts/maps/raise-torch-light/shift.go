package main

import (
	"dndshare/internal/battlemap"
	"encoding/json"
	"fmt"
)

const definitionID, lightKey = "MT1-017", "torch-flame"
const oldHeight, newHeight = 1.8, 2.2

func shiftLight(light battlemap.Light, template battlemap.ModelLight, scale float64) (battlemap.Light, error) {
	delta := (newHeight - oldHeight) * scale
	light.Height = template.Position[2] * scale
	light.Effect = battlemap.ScaleLightEffect(template.Effect, scale)
	if light.Overrides != nil {
		copy := *light.Overrides
		light.Overrides = &copy
		if copy.Height != nil {
			light.Height = *copy.Height
		}
		if copy.Effect != nil {
			light.Effect = battlemap.ScaleLightEffect(copy.Effect, 1)
		}
	}
	light.Height += delta
	if light.Effect == nil {
		return light, fmt.Errorf("Torch flame preset is missing")
	}
	light.Effect.Offset[2] -= delta
	if light.Overrides != nil {
		if light.Overrides.Height != nil {
			value := light.Height
			light.Overrides.Height = &value
		}
		if light.Overrides.Effect != nil {
			light.Overrides.Effect = light.Effect
		}
	}
	return light, battlemap.ValidateLightEffect(light.Effect)
}

func shiftDocument(raw []byte, modelIDs map[string]bool, template battlemap.ModelLight) ([]byte, int, error) {
	var d battlemap.Document
	if err := json.Unmarshal(raw, &d); err != nil {
		return nil, 0, err
	}
	owners := map[battlemap.LightAnchor]float64{}
	for _, t := range d.Tiles {
		if modelIDs[t.ModelID] {
			owners[battlemap.LightAnchor{Kind: "tile", ID: t.ID}] = 1
		}
	}
	for _, o := range d.Objects {
		if modelIDs[o.ModelID] {
			owners[battlemap.LightAnchor{Kind: "object", ID: o.ID}] = o.Scale
		}
	}
	count := 0
	for i, l := range d.Lights {
		if l.BuiltinKey != lightKey || l.Anchor == nil {
			continue
		}
		scale, ok := owners[*l.Anchor]
		if !ok {
			continue
		}
		next, err := shiftLight(l, template, scale)
		if err != nil {
			return nil, 0, err
		}
		d.Lights[i] = next
		count++
	}
	if count == 0 {
		return raw, 0, nil
	}
	if err := battlemap.ValidateDocument(&d); err != nil {
		return nil, 0, err
	}
	// Preserve unrelated top-level JSON exactly; only the light array is replaced.
	var document map[string]json.RawMessage
	if err := json.Unmarshal(raw, &document); err != nil {
		return nil, 0, err
	}
	data, err := json.Marshal(d.Lights)
	if err != nil {
		return nil, 0, err
	}
	document["lights"] = data
	result, err := json.Marshal(document)
	return result, count, err
}
