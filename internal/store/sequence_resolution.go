package store

import "fmt"

type SequenceCommand struct {
	Action         string            `json:"action"`
	ClientActionID string            `json:"clientActionId"`
	Revision       int               `json:"revision"`
	Target         ApplicationTarget `json:"target"`
	TypeID         int               `json:"typeId"`
	Mode           string            `json:"mode"`
	Critical       bool              `json:"critical"`
}

func sequenceChoices(seq, result map[string]any, roll func(int) (int, error)) ([]any, []any, error) {
	table := object(seq["table"])
	if len(table) == 0 {
		return nil, nil, nil
	}
	sides, count := number(table["sides"]), number(table["count"])
	if count < 1 || count > 10 || sides < 2 || sides > 100 {
		return nil, nil, ErrApplication
	}
	values := []any{}
	if table["source"] == "separate" {
		for range count {
			n, err := roll(sides)
			if err != nil {
				return nil, nil, err
			}
			values = append(values, n)
		}
	} else {
		for _, raw := range array(result["parts"]) {
			p := object(raw)
			if p["kind"] == "dice" && number(p["sides"]) == sides {
				values = append(values, array(p["rolls"])...)
			}
		}
		if len(values) < count {
			return nil, nil, ErrApplication
		}
		values = values[:count]
	}
	choices, seen := []any{}, map[int]bool{}
	for _, value := range values {
		found := false
		for _, raw := range array(table["rows"]) {
			row := object(raw)
			if number(row["value"]) != number(value) {
				continue
			}
			id := number(row["damage_type"])
			if id < 1 {
				return nil, nil, ErrApplication
			}
			found = true
			if !seen[id] {
				choices = append(choices, map[string]any{"id": id, "value": value})
				seen[id] = true
			}
		}
		if !found {
			return nil, nil, ErrApplication
		}
	}
	return choices, values, nil
}

func sequenceSelectType(hit map[string]any, id int, label, color string) error {
	allowed := false
	for _, raw := range array(hit["choices"]) {
		if number(object(raw)["id"]) == id {
			allowed = true
		}
	}
	if !allowed || label == "" {
		return ErrApplication
	}
	result := object(hit["result"])
	for _, raw := range array(result["parts"]) {
		part := object(raw)
		if textValue(part["label"]) == "" {
			part["label"], part["color"] = label, color
		}
	}
	sequenceTotals(result)
	result["expression"] = sequenceExpression(result)
	hit["damageType"], hit["status"], hit["damageRoll"] = map[string]any{"id": id, "label": label, "color": color}, "ready", true
	return nil
}

func sequenceCanContinue(seq, hit map[string]any) bool {
	if hit["status"] != "ready" {
		return false
	}
	if limit := sequenceJumpLimit(seq); limit > 0 {
		used := 0
		for _, raw := range array(seq["hits"]) {
			if object(raw)["jump"] == true {
				used++
			}
		}
		if used >= limit {
			return false
		}
	}
	switch object(seq["chain"])["trigger"] {
	case "matching_dice":
		return sequenceMatchingDice(object(seq["chain"]), object(hit["result"]))
	case "matching_damage":
		values := array(hit["tableValues"])
		if len(values) < 2 {
			return false
		}
		for _, v := range values[1:] {
			if number(v) != number(values[0]) {
				return false
			}
		}
		return true
	case "odd_attack":
		return sequenceNatural(object(hit["attack"]))%2 == 1
	case "always":
		return true
	}
	return false
}

func advanceSequence(seq map[string]any, cmd SequenceCommand, roll func(int) (int, error)) error {
	hits := array(seq["hits"])
	if seq["finished"] == true || len(hits) < 1 || len(hits) > 100 {
		return ErrApplication
	}
	hit := object(hits[len(hits)-1])
	status := textValue(hit["status"])
	switch cmd.Action {
	case "target":
		if status != "target" || saveTargetKey(cmd.Target) == "" {
			return ErrApplication
		}
		for _, raw := range hits[:len(hits)-1] {
			prior := object(raw)
			target := object(prior["target"])
			unique := object(seq["chain"])["unique"]
			if unique != "none" && target["key"] == saveTargetKey(cmd.Target) && (unique != "hit" || prior["status"] == "ready") {
				return fmt.Errorf("%w: эта цель уже использована", ErrApplication)
			}
		}
		if hit["attack"] == nil {
			attack, err := sequenceAttack(seq, cmd.Mode, roll)
			if err != nil {
				return err
			}
			hit["attack"] = attack
		}
		hit["target"], hit["status"] = sequenceTarget(cmd.Target), "attack"
	case "miss":
		if status != "attack" {
			return ErrApplication
		}
		hit["status"] = "miss"
	case "hit":
		if status != "attack" {
			return ErrApplication
		}
		expr := textValue(seq["damageExpression"])
		if cmd.Critical {
			expr = textValue(seq["criticalExpression"])
		}
		result, err := rollSequenceDice(expr, roll)
		if err != nil {
			return err
		}
		choices, values, err := sequenceChoices(seq, result, roll)
		if err != nil {
			return err
		}
		hit["result"], hit["choices"], hit["tableValues"], hit["critical"], hit["status"] = result, choices, values, cmd.Critical, "choice"
		if len(choices) == 0 {
			hit["status"], hit["damageRoll"] = "ready", true
		}
	case "next", "projectile":
		if status != "ready" && status != "miss" || len(hits) >= 100 {
			return ErrApplication
		}
		if cmd.Action == "next" {
			if !sequenceCanContinue(seq, hit) {
				return ErrApplication
			}
		} else {
			shot := max(1, number(seq["projectile"]))
			if shot >= min(100, max(1, number(seq["instances"]))) {
				return ErrApplication
			}
			seq["projectile"] = shot + 1
		}
		seq["hits"] = append(hits, map[string]any{"status": "target", "jump": cmd.Action == "next"})
	case "finish":
		seq["finished"] = true
	default:
		return ErrApplication
	}
	return nil
}

func sequenceTarget(t ApplicationTarget) map[string]any {
	return map[string]any{"key": saveTargetKey(t), "kind": t.Kind, "charUuid": t.CharUUID, "npcUid": t.NPCUID, "encounterId": t.EncounterID, "name": t.Name, "imageUrl": t.ImageURL, "svg": t.SVG, "letter": t.Letter, "color": t.Color}
}
