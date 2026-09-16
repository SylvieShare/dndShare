package store

import (
	"context"
	"github.com/jackc/pgx/v5"
)

func impactDefenses(ctx context.Context, tx pgx.Tx, values, npc map[string]any, manualStates []any) ([]any, error) {
	rows := append([]any{}, array(values["defenses"])...)
	sources, err := applicationRuleSources(ctx, tx, values)
	if err != nil {
		return nil, err
	}
	for _, source := range sources {
		for _, v := range array(source.Data["defenses"]) {
			if source.Level >= max(1, number(object(v)["level"])) {
				rows = append(rows, v)
			}
		}
		for _, v := range array(source.Data["choice_defenses"]) {
			rule := object(v)
			entry := map[string]any{}
			for _, candidate := range sources {
				if number(candidate.Entry["id"]) == number(rule["source_item_id"]) {
					entry = candidate.Entry
					break
				}
			}
			for _, choice := range array(object(entry["choices"])[textValue(rule["choice_key"])]) {
				for _, option := range array(rule["options"]) {
					o := object(option)
					if textValue(o["value"]) == textValue(choice) {
						rows = append(rows, map[string]any{"damage_type": o["damage_type"], "kind": o["kind"]})
					}
				}
			}
		}
	}
	for _, v := range array(values["states"]) {
		state := object(v)
		if state["external_only"] == true || number(state["effect_id"]) <= 0 {
			continue
		}
		_, data, _, err := applicationItem(ctx, tx, int64(number(state["effect_id"])))
		if err != nil {
			return nil, err
		}
		rows = append(rows, array(data["defenses"])...)
	}
	for _, v := range manualStates {
		id := number(v)
		if id == 0 {
			id = number(object(v)["id"])
		}
		if id <= 0 {
			continue
		}
		_, data, _, err := applicationItem(ctx, tx, int64(id))
		if err != nil {
			return nil, err
		}
		rows = append(rows, array(data["defenses"])...)
	}
	for field, kind := range map[string]string{"damage_resistances": "resistance", "damage_immunities": "immunity", "damage_vulnerabilities": "vulnerability"} {
		for _, id := range array(npc[field]) {
			rows = append(rows, map[string]any{"damage_type": id, "kind": kind})
		}
	}
	return rows, nil
}
