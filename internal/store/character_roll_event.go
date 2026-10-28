package store

// Match the existing web/native dice event contract, including cast sequences.
func characterRollEvent(p PreparedCharacterD20, roll map[string]any) map[string]any {
	data := map[string]any{}
	for key, value := range p.Request.EventData {
		data[key] = value
	}
	result := characterDiceResultData(roll)
	data["title"] = p.Request.Title
	data["kind"] = p.Request.Kind
	data["result"] = result
	if p.Request.Kind == "attack" {
		data["attackRoll"] = true
		if original, ok := data["sequence"].(map[string]any); ok {
			sequence := map[string]any{}
			for key, value := range original {
				sequence[key] = value
			}
			sequence["hits"] = []any{map[string]any{"attack": result, "status": "target"}}
			data["sequence"] = sequence
		}
	}
	if p.Request.SourceItemID != nil && *p.Request.SourceItemID > 0 {
		source := map[string]any{"itemId": *p.Request.SourceItemID, "name": p.Request.SourceName}
		if p.Request.TargetUID != "" {
			source["instanceUid"] = p.Request.TargetUID
		}
		data["source"] = source
	}
	if id := p.Request.Ability; id != nil && *id >= 1 && *id <= 6 {
		data["ability"] = map[string]any{"id": *id, "typeId": 16, "name": []string{"Сила", "Ловкость", "Телосложение", "Интеллект", "Мудрость", "Харизма"}[*id-1]}
	}
	threshold := p.Request.CriticalThreshold
	if threshold == 0 {
		threshold = 20
	}
	natural := number(roll["selected"])
	if natural >= threshold {
		data["outcome"] = map[string]any{"kind": "crit", "sides": 20, "value": natural}
	} else if natural == 1 && len(array(roll["adjustments"])) == 0 {
		data["outcome"] = map[string]any{"kind": "fumble", "sides": 20, "value": 1}
	}
	return data
}

func characterDiceResultData(roll map[string]any) map[string]any {
	result := map[string]any{"parts": roll["parts"], "byType": roll["byType"], "total": roll["total"], "expression": roll["expression"], "rollMode": roll["mode"]}
	if rows := array(roll["adjustments"]); len(rows) > 0 {
		result["adjustments"] = rows
	}
	if roll["karmicDice"] != nil {
		result["karmicDice"] = roll["karmicDice"]
	}
	return result
}
