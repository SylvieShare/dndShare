package store

import (
	"crypto/rand"
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

func karmicWeights(balance int, mode string) [20]float64 {
	var weights [20]float64
	for i := range weights {
		face := i + 1
		weights[i] = 1 + 0.85*float64(balance)/karmicLimit*(2*float64(i)/19-1)
		if (balance == karmicLimit && face <= karmicMedian(mode)) || (balance == -karmicLimit && face > karmicMedian(mode)) {
			weights[i] = 0
		}
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

func karmicNextBalance(balance, natural int, mode string) int {
	if natural <= karmicMedian(mode) {
		return min(karmicLimit, balance+1)
	}
	return max(-karmicLimit, balance-1)
}

func randomUnit() (float64, error) {
	value, err := rand.Int(rand.Reader, big.NewInt(1<<53))
	if err != nil {
		return 0, err
	}
	return float64(value.Int64()) / (1 << 53), nil
}
