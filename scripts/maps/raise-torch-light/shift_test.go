package main

import (
	"dndshare/internal/battlemap"
	"encoding/json"
	"math"
	"testing"
)

func TestShiftDocumentKeepsOtherLightsAndDocumentFields(t *testing.T) {
	template := battlemap.ModelLight{Position: [3]float64{.2, .2, oldHeight}, Effect: &battlemap.LightEffect{Kind: "fire", Size: [2]float64{.22, .35}, Strength: .7, Offset: [3]float64{0, 0, -.208657}}}
	light := battlemap.Light{ID: "light", BuiltinKey: lightKey, Name: "Свет", Kind: "torch", Color: "#ffb04a", X: 2.2, Y: 2.2, Height: oldHeight, Radius: 4, Enabled: false, Anchor: &battlemap.LightAnchor{Kind: "tile", ID: "torch"}}
	other := light
	other.ID = "other"
	other.Anchor = &battlemap.LightAnchor{Kind: "tile", ID: "other"}
	d := battlemap.Document{Version: 2, Kind: "tiles", Width: 8, Height: 8, Tiles: []battlemap.Tile{{ID: "torch", ModelID: "00000000-0000-4000-8000-000000000017", X: 2, Y: 2}, {ID: "other", ModelID: "00000000-0000-4000-8000-000000000018", X: 3, Y: 3}}, Lights: []battlemap.Light{light, other}}
	raw, _ := json.Marshal(d)
	var fields map[string]json.RawMessage
	json.Unmarshal(raw, &fields)
	fields["unrelated"] = json.RawMessage(`{"saved":true}`)
	raw, _ = json.Marshal(fields)
	after, n, err := shiftDocument(raw, map[string]bool{"00000000-0000-4000-8000-000000000017": true}, template)
	if err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatal("wrong owners changed", n)
	}
	json.Unmarshal(after, &d)
	if math.Abs(d.Lights[0].Height-newHeight) > 1e-9 || d.Lights[0].Enabled || d.Lights[1].Height != oldHeight {
		t.Fatal(d.Lights)
	}
	json.Unmarshal(after, &fields)
	if string(fields["unrelated"]) != `{"saved":true}` {
		t.Fatal("unrelated JSON lost")
	}
}

func TestShiftPreservesFlameAndInstanceOverrides(t *testing.T) {
	template := battlemap.ModelLight{Position: [3]float64{.2, .2, oldHeight}, Effect: &battlemap.LightEffect{Kind: "fire", Size: [2]float64{.22, .35}, Strength: .7, Offset: [3]float64{0, 0, -.208657}}}
	for _, scale := range []float64{1, 2} {
		light := battlemap.Light{Enabled: false, Color: "#123456", Shadows: true}
		shifted, err := shiftLight(light, template, scale)
		if err != nil {
			t.Fatal(err)
		}
		before := (template.Position[2] + template.Effect.Offset[2]) * scale
		if math.Abs(shifted.Height+shifted.Effect.Offset[2]-before) > 1e-9 || shifted.Enabled || !shifted.Shadows || shifted.Color != "#123456" {
			t.Fatal("lost state or moved flame", shifted)
		}
	}
	h := 2.7
	e := battlemap.ScaleLightEffect(template.Effect, 1)
	e.Size = [2]float64{.5, .7}
	light := battlemap.Light{Overrides: &battlemap.LightOverrides{Height: &h, Effect: e}}
	shifted, err := shiftLight(light, template, 1)
	if err != nil {
		t.Fatal(err)
	}
	if math.Abs(shifted.Height-3.1) > 1e-9 || shifted.Effect.Size != e.Size || math.Abs(shifted.Height+shifted.Effect.Offset[2]-(h+e.Offset[2])) > 1e-9 {
		t.Fatal(shifted)
	}
	if *light.Overrides.Height != 2.7 || light.Overrides.Effect.Offset[2] != -.208657 {
		t.Fatal("input changed")
	}
}
