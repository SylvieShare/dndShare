package store

import (
	"math"
	"testing"
)

func TestKarmicDistributionAndSeries(t *testing.T) {
	for _, mode := range []string{"normal", "advantage", "disadvantage"} {
		for _, balance := range []float64{-6, -5.9, -3.2, -0.1, 0, 0.1, 3.2, 5.9, 6} {
			weights := karmicWeights(balance, mode)
			for i := 0; i < 10000; i++ {
				face := karmicFace(weights, float64(i)/10000)
				if face < 1 || face > 20 {
					t.Fatal("invalid face", face)
				}
				if balance == 6 && face <= karmicMedian(mode) {
					t.Fatal("low series continued at limit", mode, face)
				}
				if balance == -6 && face > karmicMedian(mode) {
					t.Fatal("high series continued at limit", mode, face)
				}
			}
		}
	}
	neutral := karmicWeights(0, "normal")
	for face, weight := range neutral {
		if weight != 1 {
			t.Fatalf("face %d is not uniform", face+1)
		}
	}
	for _, balance := range []float64{-5, 0, 5} {
		mean := 0.0
		for i := 0; i < 10000; i++ {
			mean += float64(karmicFace(karmicWeights(balance, "normal"), float64(i)/10000)) / 10000
		}
		if (balance < 0 && mean >= 10.5) || (balance > 0 && mean <= 10.5) || (balance == 0 && math.Abs(mean-10.5) > 0.01) {
			t.Fatal("wrong shift", balance, mean)
		}
	}
	for _, mode := range []string{"normal", "advantage", "disadvantage"} {
		balance := 0.0
		for range 6 {
			balance = karmicNextBalance(balance, 1, mode)
		}
		face := karmicFace(karmicWeights(balance, mode), 0)
		if karmicNextBalance(balance, face, mode) != 5.9 {
			t.Fatal("series does not turn toward center", mode)
		}
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
