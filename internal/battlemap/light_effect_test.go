package battlemap

import "testing"

func TestLightEffectValidationAndTemplateOverrides(t *testing.T) {
	e := &LightEffect{Kind: "fire", Size: [2]float64{.2, .4}, Strength: .7, Offset: [3]float64{0, 0, -.2}}
	if err := ValidateLightEffect(e); err != nil {
		t.Fatal(err)
	}
	scaled := ScaleLightEffect(e, 2)
	if scaled.Size[1] != .8 || scaled.Offset[2] != -.4 || e.Size[1] != .4 {
		t.Fatal("scaling mutated template", scaled, e)
	}
	light := Light{Effect: scaled, Overrides: &LightOverrides{Effect: &LightEffect{Kind: "none", Size: [2]float64{.3, .6}, Offset: [3]float64{0, 0, -.1}}}}
	applyLightOverrides(&light)
	if light.Effect.Kind != "none" || light.Effect.Size[1] != .6 {
		t.Fatal("override rescaled or lost", light)
	}
	invalid := *e
	invalid.Size[0] = 0
	if ValidateLightEffect(&invalid) == nil {
		t.Fatal("invalid size accepted")
	}
	invalid = *e
	invalid.Kind = "smoke"
	if ValidateLightEffect(&invalid) == nil {
		t.Fatal("unsupported effect accepted")
	}
}
