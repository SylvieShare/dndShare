package battlemap

import (
	"math"
	"testing"
)

func TestWaterAnimationValidation(t *testing.T) {
	for _, w := range []WaterAnimation{{true, 0, 0}, {false, 3, 2}, {true, 1, .7}} {
		if err := ValidateModelBehaviour(ModelBehaviour{Revision: 1, WaterAnimation: &w}); err != nil {
			t.Fatal(err)
		}
	}
	for _, w := range []WaterAnimation{{true, -1, .7}, {true, 3.01, .7}, {false, 1, -1}, {false, 1, 2.01}, {true, math.NaN(), .7}, {true, 1, math.Inf(1)}} {
		if ValidateModelBehaviour(ModelBehaviour{Revision: 1, WaterAnimation: &w}) == nil {
			t.Fatalf("accepted invalid water animation: %+v", w)
		}
	}
}
