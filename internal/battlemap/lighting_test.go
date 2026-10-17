package battlemap

import "testing"

func TestMapLightingValidation(t *testing.T) {
	d := Presets()[0].Document
	d.Lights = []Light{{ID: "torch", Name: "Факел", Kind: "torch", Color: "#ffc36a", X: 3, Y: 3, Height: .9, Intensity: 8, Radius: 4, Enabled: true, Shadows: true, Anchor: &LightAnchor{Kind: "tile", ID: d.Tiles[0].ID}}}
	if err := ValidateDocument(&d); err != nil {
		t.Fatal(err)
	}
	for _, bad := range []func(*Document){
		func(d *Document) { d.Sun = &SunLight{Angle: 400, Elevation: 45} },
		func(d *Document) { d.Lights[0].Color = "invalid" },
		func(d *Document) { d.Lights[0].Anchor = &LightAnchor{Kind: "tile", ID: "missing"} },
		func(d *Document) { d.Lights[0].Radius = 0 },
		func(d *Document) { d.Lights[0].AreaID = "missing" },
	} {
		copy := d
		copy.Lights = append([]Light(nil), d.Lights...)
		bad(&copy)
		if ValidateDocument(&copy) == nil {
			t.Fatal("invalid lighting accepted")
		}
	}
}

func TestMultipleLocalShadowSourcesAreAllowed(t *testing.T) {
	d := Presets()[0].Document
	for i, id := range []string{"a", "b", "c", "d"} {
		d.Lights = append(d.Lights, Light{ID: id, Name: "Факел", Kind: "torch", Color: "#ffc36a", X: float64(i + 1), Y: 2, Height: 1, Radius: 4, Intensity: 8, Enabled: true, Shadows: true})
	}
	if err := ValidateDocument(&d); err != nil {
		t.Fatal(err)
	}
}
