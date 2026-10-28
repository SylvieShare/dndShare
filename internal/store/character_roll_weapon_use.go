package store

import (
	"dndshare/internal/documentpatch"
	"encoding/json"
)

// Resolve the real current instance, then commit the attack into its independent
// step snapshot. A reroll updates only attack/critical and preserves rolled steps.
func prepareCharacterWeaponUse(raw json.RawMessage, op *CharacterRollWeaponUse, p PreparedCharacterD20) (func(map[string]any) (json.RawMessage, error), error) {
	if op == nil {
		return func(map[string]any) (json.RawMessage, error) { return raw, nil }, nil
	}
	if op.UID == "" || len(op.UID) > 200 || p.Request.Kind != "attack" || p.Request.TargetUID != op.UID {
		return nil, ErrApplication
	}
	root, err := documentpatch.Decode(raw)
	if err != nil {
		return nil, err
	}
	decoded, ok := root.(map[string]any)
	if !ok {
		return nil, ErrApplication
	}
	if _, ok := decoded["values"].(map[string]any); !ok {
		return nil, ErrApplication
	}
	doc := transferDocument(decoded)
	var entry map[string]any
	for _, container := range append(doc.usableContainers("weapon"), doc.usableContainers("items")...) {
		for _, row := range array(container.values[container.key]) {
			current := object(row)
			if textValue(current["uid"]) == op.UID {
				if entry != nil {
					return nil, ErrApplication
				}
				entry = current
			}
		}
	}
	if entry == nil {
		return nil, ErrCharacterVersion
	}
	params := object(entry["params"])
	magic := object(params["magic"])
	if magic["lost"] == true || object(params["creation"])["expired"] == true {
		return nil, ErrCharacterVersion
	}
	current := object(magic["weapon_use"])
	var event map[string]any
	if op.Start != nil {
		if op.ID != "" || current["status"] == "active" {
			return nil, ErrCharacterVersion
		}
		id := textValue(op.Start["id"])
		if id == "" || len(id) > 100 || op.Start["status"] != "active" || len(array(op.Start["steps"])) == 0 || len(array(op.Start["steps"])) > 100 || textValue(p.Request.EventData["weaponUseId"]) != id {
			return nil, ErrApplication
		}
		var previous any
		if len(op.Previous) > 0 {
			previous, err = documentpatch.Decode(op.Previous)
			if err != nil {
				return nil, ErrApplication
			}
		}
		if !documentpatch.Equal(magic["weapon_use"], previous) {
			return nil, ErrCharacterVersion
		}
		event = map[string]any{}
		for key, value := range op.Start {
			event[key] = value
		}
	} else {
		if op.ID == "" || current["status"] != "active" || textValue(current["id"]) != op.ID || textValue(p.Request.EventData["weaponUseId"]) != op.ID {
			return nil, ErrCharacterVersion
		}
		event = current
	}
	return func(roll map[string]any) (json.RawMessage, error) {
		threshold := p.Request.CriticalThreshold
		if threshold == 0 {
			threshold = 20
		}
		event["attack_result"] = characterDiceResultData(roll)
		event["critical"] = number(roll["selected"]) >= threshold
		magic["weapon_use"] = event
		params["magic"] = magic
		entry["params"] = params
		return json.Marshal(doc)
	}, nil
}
