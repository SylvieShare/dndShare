package store

import (
	"crypto/rand"
	"math"
	"math/big"
)

const karmicLimit = 6

// Use each mode's neutral median, so ordinary advantage/disadvantage does not
// continuously push the scale against that mode. Bonuses and DC do not enter it.
func karmicMedian(mode string) int {
	switch mode {
	case "advantage":
		return 14
	case "disadvantage":
		return 6
	default:
		return 10
	}
}

func karmicWeights(balance float64) [20]float64 {
	var weights [20]float64
	for i := range weights {
		weights[i] = 1 + 0.85*balance/karmicLimit*(2*float64(i)/19-1)
	}
	return weights
}

func karmicFace(weights [20]float64, unit float64) int {
	total := 0.0
	for _, weight := range weights {
		total += weight
	}
	target := unit * total
	for i, weight := range weights {
		if weight > 0 && target < weight {
			return i + 1
		}
		target -= weight
	}
	for i := 19; i >= 0; i-- {
		if weights[i] > 0 {
			return i + 1
		}
	}
	return 20
}

// Rank a kept face against its mode's neutral distribution. This makes a
// typical advantage/disadvantage result a small correction, while extreme
// tails matter more. Normal rolls give exactly +1...+0.1,-0.1...-1.
func karmicDelta(natural int, mode string) float64 {
	cdf := func(face int) float64 {
		p := float64(face) / 20
		switch mode {
		case "advantage":
			return p * p
		case "disadvantage":
			return 1 - (1-p)*(1-p)
		default:
			return p
		}
	}
	centeredRank := 1 - cdf(natural) - cdf(natural-1)
	delta := max(0.1, math.Round(min(1, math.Abs(centeredRank)+0.05)*10)/10)
	if natural > karmicMedian(mode) {
		delta = -delta
	}
	return delta
}

func karmicNextBalance(balance float64, natural int, mode string) float64 {
	return math.Round(max(-karmicLimit, min(karmicLimit, balance+karmicDelta(natural, mode)))*10) / 10
}

func randomUnit() (float64, error) {
	value, err := rand.Int(rand.Reader, big.NewInt(1<<53))
	if err != nil {
		return 0, err
	}
	return float64(value.Int64()) / (1 << 53), nil
}
