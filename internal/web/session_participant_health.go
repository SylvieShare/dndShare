package web

import (
	"math"
	"strconv"
	"strings"

	"dndshare/internal/store"
)

// Match the sheet's hpMaximum: nonnegative base plus signed integer bonuses.
func participantHP(participant store.SessionParticipantData) (float64, float64, bool) {
	if participant.TemplateName != "DND5" {
		return 0, 0, false
	}
	hp := objectValue(objectValue(participant.Data, "values"), "hp")
	maximumData := objectValue(hp, "max")
	maximum := math.Max(0, healthInteger(maximumData["base"]))
	bonuses, _ := maximumData["bonuses"].([]any)
	for _, entry := range bonuses {
		bonus, _ := entry.(map[string]any)
		maximum += healthInteger(bonus["value"])
	}
	maximum = math.Max(0, maximum)
	return healthInteger(hp["current"]), maximum, maximum > 0
}

func healthInteger(value any) float64 {
	var number float64
	if text, ok := value.(string); ok {
		number, _ = strconv.ParseFloat(strings.TrimSpace(text), 64)
	} else {
		number, _ = numberValue(map[string]any{"value": value}, "value")
	}
	if math.IsNaN(number) || math.IsInf(number, 0) {
		return 0
	}
	return math.Trunc(number)
}
