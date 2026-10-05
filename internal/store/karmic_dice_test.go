package store

import (
	"math"
	"testing"
)

func TestKarmicDistribution(t *testing.T) {
	for _, balance := range []float64{-6, -5.9, -3.2, -0.1, 0, 0.1, 3.2, 5.9, 6} {
		weights := karmicWeights(balance)
		for face, weight := range weights {
			if weight <= 0 {
				t.Fatalf("balance %v removes face %d", balance, face+1)
			}
		}
		counts := [20]int{}
		for i := 0; i < 10000; i++ {
			face := karmicFace(weights, float64(i)/10000)
			if face < 1 || face > 20 {
				t.Fatal("invalid face", face)
			}
			counts[face-1]++
		}
		for face, count := range counts {
			if count == 0 {
				t.Fatalf("balance %v cannot roll face %d", balance, face+1)
			}
		}
	}
	neutral := karmicWeights(0)
	for face, weight := range neutral {
		if weight != 1 {
			t.Fatalf("face %d is not uniform", face+1)
		}
	}
	for _, balance := range []float64{-5, 0, 5} {
		mean := 0.0
		for i := 0; i < 10000; i++ {
			mean += float64(karmicFace(karmicWeights(balance), float64(i)/10000)) / 10000
		}
		if (balance < 0 && mean >= 10.5) || (balance > 0 && mean <= 10.5) || (balance == 0 && math.Abs(mean-10.5) > 0.01) {
			t.Fatal("wrong shift", balance, mean)
		}
	}
	// At maximum tilt the opposite extreme still has 0.75%, rather than zero.
	for _, balance := range []float64{-6, 6} {
		weights, sum := karmicWeights(balance), 0.0
		for _, weight := range weights {
			sum += weight
		}
		for _, face := range []int{1, 20} {
			expected := 0.0075
			if (balance > 0 && face == 20) || (balance < 0 && face == 1) {
				expected = 0.0925
			}
			if math.Abs(weights[face-1]/sum-expected) > 1e-12 {
				t.Fatal("wrong endpoint probability", balance, face)
			}
		}
	}
	if karmicFace(karmicWeights(6), 0) != 1 || karmicFace(karmicWeights(-6), math.Nextafter(1, 0)) != 20 {
		t.Fatal("extreme karma guarantees the opposite result")
	}
}

func TestKarmicFractionalCorrections(t *testing.T) {
	for natural := 1; natural <= 20; natural++ {
		expected := float64(11-natural) / 10
		if natural > 10 {
			expected = float64(10-natural) / 10
		}
		if got := karmicDelta(natural, "normal"); got != expected {
			t.Fatalf("d20 %d: got %v, want %v", natural, got, expected)
		}
	}
	for _, mode := range []string{"normal", "advantage", "disadvantage"} {
		if karmicDelta(1, mode) != 1 || karmicDelta(20, mode) != -1 {
			t.Fatal("extremes lost their full correction", mode)
		}
		if karmicDelta(karmicMedian(mode), mode) != 0.1 || karmicDelta(karmicMedian(mode)+1, mode) != -0.1 {
			t.Fatal("typical mode result should have a small correction", mode)
		}
		expected := 0.0
		for a := 1; a <= 20; a++ {
			for b := 1; b <= 20; b++ {
				expected += karmicDelta(keptD20(a, b, mode), mode) / 400
			}
		}
		if mode != "normal" && math.Abs(expected) > 0.025 {
			t.Fatal("mode itself creates a large drift", mode, expected)
		}
	}
	if karmicNextBalance(0, 10, "normal") != 0.1 || karmicNextBalance(0.1, 11, "normal") != 0 {
		t.Fatal("small symmetric rolls did not cancel")
	}
	if karmicNextBalance(5.9, 1, "normal") != 6 || karmicNextBalance(-5.9, 20, "normal") != -6 {
		t.Fatal("fractional balance exceeded limits")
	}
	if karmicNextBalance(0.2, 10, "normal") != 0.3 {
		t.Fatal("floating point tails entered balance")
	}
}

func TestSessionD20Validation(t *testing.T) {
	base := SessionD20Request{Kind: "attack", Mode: "normal"}
	if !ValidSessionD20Request(base) {
		t.Fatal("valid request rejected")
	}
	for _, kind := range []string{"initiative", "damage", "death_save", "", "d20"} {
		req := base
		req.Kind = kind
		if ValidSessionD20Request(req) {
			t.Fatal("invalid kind accepted", kind)
		}
	}
	for _, value := range []int{0, 21} {
		req := base
		req.Mode = "advantage"
		req.Previous = &value
		if ValidSessionD20Request(req) {
			t.Fatal("invalid previous accepted")
		}
	}
	value := 12
	base.Previous = &value
	if ValidSessionD20Request(base) {
		t.Fatal("normal roll accepted extra die")
	}
	base.Mode = "advantage"
	if !ValidSessionD20Request(base) || keptD20(4, 18, "advantage") != 18 || keptD20(4, 18, "disadvantage") != 4 {
		t.Fatal("roll mode broken")
	}
}

func TestKarmicChartProbabilities(t *testing.T) {
	for _, balance := range []float64{-6, -1.7, 0, 1.7, 6} {
		probabilities, total := karmicProbabilities(balance), 0.0
		for _, chance := range probabilities {
			if chance <= 0 || chance >= 1 {
				t.Fatal("invalid graph probability", chance)
			}
			total += chance
		}
		if math.Abs(total-1) > 1e-12 {
			t.Fatal("graph probabilities do not sum to one", total)
		}
		if balance == 0 {
			for _, chance := range probabilities {
				if chance != .05 {
					t.Fatal("neutral graph is not uniform")
				}
			}
		}
	}
	positive, negative := karmicProbabilities(6), karmicProbabilities(-6)
	if math.Abs(positive[0]-.0075) > 1e-12 || math.Abs(positive[19]-.0925) > 1e-12 {
		t.Fatal("graph does not show actual d20 extremes")
	}
	for index := range positive {
		if math.Abs(positive[index]-negative[19-index]) > 1e-12 {
			t.Fatal("opposite tilts are not symmetric")
		}
	}
}
