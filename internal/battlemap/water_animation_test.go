package battlemap

import (
	"math"
	"testing"
)

func TestWaterAnimationValidation(t *testing.T) {
	for _, w := range []WaterAnimation{{Enabled: true, Speed: 0, Strength: 0}, {Enabled: false, Speed: 3, Strength: 2}, {Enabled: true, Speed: 1, Strength: .7}} {
		if err := ValidateModelBehaviour(ModelBehaviour{Revision: 1, WaterAnimation: &w}); err != nil {
			t.Fatal(err)
		}
	}
	for _, w := range []WaterAnimation{{Enabled: true, Speed: -1, Strength: .7}, {Enabled: true, Speed: 3.01, Strength: .7}, {Speed: 1, Strength: -1}, {Speed: 1, Strength: 2.01}, {Speed: math.NaN(), Strength: .7}, {Speed: 1, Strength: math.Inf(1)}, {Pattern: "lava"}, {RoughnessMax: 1.1}, {Center: [2]float64{0, math.NaN()}}} {
		if ValidateModelBehaviour(ModelBehaviour{Revision: 1, WaterAnimation: &w}) == nil {
			t.Fatalf("accepted invalid water animation: %+v", w)
		}
	}
}
