package battlemap

import (
	"fmt"
	"strings"
)

type ModelLight struct {
	Key       string     `json:"key"`
	Name      string     `json:"name"`
	Kind      string     `json:"kind"`
	Color     string     `json:"color"`
	Position  [3]float64 `json:"position"`
	Intensity float64    `json:"intensity"`
	Radius    float64    `json:"radius"`
	Enabled   bool       `json:"enabled"`
	Flicker   bool       `json:"flicker"`
}

type ModelTransition struct {
	ID             string `json:"id"`
	ToDefinitionID string `json:"toDefinitionId"`
	Action         string `json:"action"`
}

type ModelBehaviour struct {
	Revision      int               `json:"revision"`
	DefaultLights []ModelLight      `json:"defaultLights"`
	Transitions   []ModelTransition `json:"transitions"`
}

func ValidTransitionAction(action string) bool {
	switch action {
	case "open", "close", "extinguish", "ignite", "empty", "fill":
		return true
	}
	return false
}

func ValidateModelBehaviour(b ModelBehaviour) error {
	if b.Revision < 1 || len(b.DefaultLights) > 8 || len(b.Transitions) > 32 {
		return fmt.Errorf("Некорректное число источников или переходов модели")
	}
	keys, edges, ids := map[string]bool{}, map[string]bool{}, map[string]bool{}
	for _, l := range b.DefaultLights {
		if !identifier.MatchString(l.Key) || len(l.Key) > 32 || keys[l.Key] || strings.TrimSpace(l.Name) == "" || len([]rune(l.Name)) > 100 ||
			(l.Kind != "torch" && l.Kind != "candle" && l.Kind != "magic") || !color.MatchString(l.Color) ||
			!bounded(l.Position[0], -8, 8) || !bounded(l.Position[1], -8, 8) || !bounded(l.Position[2], 0, 32) ||
			!bounded(l.Intensity, 0, 50) || !bounded(l.Radius, .25, 32) {
			return fmt.Errorf("Некорректный встроенный источник света")
		}
		keys[l.Key] = true
	}
	for _, t := range b.Transitions {
		key := t.ToDefinitionID + ":" + t.Action
		if !modelIdentifier.MatchString(t.ID) || ids[t.ID] || strings.TrimSpace(t.ToDefinitionID) == "" || len(t.ToDefinitionID) > 512 || !ValidTransitionAction(t.Action) || edges[key] {
			return fmt.Errorf("Некорректный или повторяющийся переход модели")
		}
		ids[t.ID], edges[key] = true, true
	}
	return nil
}
