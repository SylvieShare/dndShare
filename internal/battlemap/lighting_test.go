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
		func(d *Document) {
			a := d.Lights[0]
			a.ID = "second"
			b := a
			b.ID = "third"
			d.Lights = append(d.Lights, a, b)
		},
	} {
		copy := d
		copy.Lights = append([]Light(nil), d.Lights...)
		bad(&copy)
		if ValidateDocument(&copy) == nil {
			t.Fatal("invalid lighting accepted")
		}
	}
}
