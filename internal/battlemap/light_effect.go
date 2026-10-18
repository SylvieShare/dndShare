package battlemap

import "fmt"

// A visual belongs to its light: it shares identity, colour, power and anchor.
type LightEffect struct {
	Kind     string     `json:"kind"`
	Size     [2]float64 `json:"size"`
	Strength float64    `json:"strength"`
	Offset   [3]float64 `json:"offset"`
}

func ValidateLightEffect(e *LightEffect) error {
	if e == nil {
		return nil
	}
	if (e.Kind != "fire" && e.Kind != "none") || !bounded(e.Size[0], .02, 8) || !bounded(e.Size[1], .02, 16) || !bounded(e.Strength, 0, 2) {
		return fmt.Errorf("Некорректное пламя источника света")
	}
	for _, v := range e.Offset {
		if !bounded(v, -32, 32) {
			return fmt.Errorf("Некорректное смещение пламени")
		}
	}
	return nil
}

func ScaleLightEffect(e *LightEffect, scale float64) *LightEffect {
	if e == nil {
		return nil
	}
	r := *e
	for i := range r.Size {
		r.Size[i] *= scale
	}
	for i := range r.Offset {
		r.Offset[i] *= scale
	}
	return &r
}
