package store

import (
	"dndshare/internal/documentpatch"
	"fmt"
	"math"
	"strings"
)

func ValidCharacterRoll(r CharacterRollRequest) bool {
	p := r.Prepared
	q := p.Request
	if r.Version < 0 || r.SessionUUID == "" || q.Formula != nil || q.Title == "" || len([]rune(q.Title)) > 255 || len(q.SourceName) > 1000 || len(q.TargetUID) > 200 {
		return false
	}
	if q.Kind != "attack" && q.Kind != "saving_throw" && q.Kind != "ability_check" && q.Kind != "skill_check" && q.Kind != "initiative" {
		return false
	}
	if p.Mode != "normal" && p.Mode != "advantage" && p.Mode != "disadvantage" {
		return false
	}
	if len(r.Patches) > 100 || len(r.Before) != len(r.Patches) || len(p.BonusDice) > 2000 || len(p.BonusParts) > 4000 || len(p.Sources) > 500 || len(p.BonusExpression) > 4000 {
		return false
	}
	if math.Abs(float64(number(p.MinimumRule["value"]))) > 1_000_000 || math.Abs(float64(p.Flat)) > 1_000_000 || math.Abs(float64(p.BonusTotal)) > 1_000_000_000 {
		return false
	}
	if q.CriticalThreshold != 0 && (q.CriticalThreshold < 2 || q.CriticalThreshold > 20) {
		return false
	}
	for i, patch := range r.Patches {
		if len(patch.Path) < 2 || patch.Path[0] != "values" || !documentpatch.Equal(patch.Path, r.Before[i].Path) {
			return false
		}
	}
	return true
}

func resolveCharacterD20(p PreparedCharacterD20, d SessionD20Result) map[string]any {
	rolls := d.Rolls
	selected := rolls[0]
	kept := 0
	for i, face := range rolls {
		if (p.Mode == "disadvantage" && face < selected) || (p.Mode != "disadvantage" && face > selected) {
			selected = face
			kept = i
		}
	}
	value := selected
	adjustments := []any{}
	sources := append([]string{}, p.Sources...)
	if minimum := number(p.MinimumRule["value"]); minimum > selected {
		value = minimum
		label := textValue(p.MinimumRule["label"])
		if label == "" {
			label = textValue(p.MinimumRule["source_label"])
		}
		if label == "" {
			label = "Корректировка броска"
		}
		adjustments = append(adjustments, map[string]any{"kind": "minimum_natural", "label": label, "original": selected, "value": value})
		sources = append(sources, fmt.Sprintf("%s: %d → %d", label, selected, value))
	}
	first := map[string]any{"kind": "dice", "operator": "+", "sign": "+", "n": len(rolls), "sides": 20, "rolls": rolls, "sum": value, "label": nil, "color": nil}
	if p.Mode != "normal" {
		dropped := []int{}
		for i := range rolls {
			if i != kept {
				dropped = append(dropped, i)
			}
		}
		first["keptIndex"] = kept
		first["dropped"] = dropped
	}
	parts := []any{first}
	for _, part := range p.BonusParts {
		parts = append(parts, part)
	}
	if p.Flat != 0 {
		sign := "+"
		if p.Flat < 0 {
			sign = "-"
		}
		parts = append(parts, map[string]any{"kind": "flat", "operator": sign, "sign": sign, "value": int(math.Abs(float64(p.Flat))), "sum": int(math.Abs(float64(p.Flat))), "label": nil, "color": nil})
	}
	total := value + p.Flat + p.BonusTotal
	expression := fmt.Sprintf("%dd20%+d", len(rolls), p.Flat)
	if p.BonusExpression != "" {
		expression += "+" + p.BonusExpression
	}
	expression = strings.ReplaceAll(expression, "+-", "-")
	bonusDice := p.BonusDice
	if bonusDice == nil {
		bonusDice = []int{}
	}
	result := map[string]any{"title": p.Request.Title, "mode": p.Mode, "rolls": rolls, "selected": selected, "bonus": p.Flat + p.BonusTotal, "bonusDice": bonusDice, "total": total, "sources": sources, "parts": parts, "byType": []any{map[string]any{"label": nil, "color": nil, "value": total}}, "expression": expression, "adjustments": adjustments}
	if d.Karmic {
		result["karmicDice"] = map[string]any{"before": d.BalanceBefore, "after": d.BalanceAfter}
	}
	return result
}
