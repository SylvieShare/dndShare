package store

import "fmt"

func validateApplicationDuration(d map[string]any) error {
	kind := textValue(d["kind"])
	switch kind {
	case "", "manual", "until_rest", "permanent":
		return nil
	case "custom":
		if textValue(d["text"]) != "" {
			return nil
		}
	case "rounds", "minutes", "hours", "days":
		if f := textValue(d["formula"]); f != "" {
			_, err := rollApplication(f, func(int) (int, error) { return 1, nil })
			return err
		}
		if number(d["value"]) > 0 && number(d["value"]) <= 10000 {
			return nil
		}
	}
	return ErrApplication
}

func applyApplication(doc transferDocument, p ApplicationPlan, uid string, roll func(int) (int, error)) (ApplicationResult, error) {
	r := ApplicationResult{Effects: []ApplicationEffect{}, Note: p.Note}
	values := doc.values()
	hp := object(values["hp"])
	if p.Healing != "" {
		v, err := rollApplication(p.Healing, roll)
		if err != nil {
			return r, err
		}
		maximum := number(hp["max"])
		if m, ok := hp["max"].(map[string]any); ok {
			maximum = number(m["base"])
			for _, b := range array(m["bonuses"]) {
				maximum += number(object(b)["value"])
			}
		}
		if p.maximumHP != nil {
			maximum = *p.maximumHP
		}
		current := max(0, number(hp["current"]))
		v.Applied = min(v.Total, max(0, maximum-current))
		hp["current"] = float64(current + v.Applied)
		if current == 0 && v.Applied > 0 {
			hp["ds_success"] = float64(0)
			hp["ds_failure"] = float64(0)
		}
		r.Healing = &v
	}
	if p.TemporaryHP != "" {
		v, err := rollApplication(p.TemporaryHP, roll)
		if err != nil {
			return r, err
		}
		previous := max(0, number(hp["temp"]))
		v.Applied = max(0, v.Total-previous)
		hp["temp"] = float64(max(previous, v.Total))
		r.TemporaryHP = &v
	}
	if r.Healing != nil || r.TemporaryHP != nil {
		values["hp"] = hp
	}
	states := array(values["states"])
	for index, e := range p.Effects {
		duration := map[string]any{}
		for k, v := range e.Duration {
			duration[k] = v
		}
		if f := textValue(duration["formula"]); f != "" {
			v, err := rollApplication(f, roll)
			if err != nil {
				return r, err
			}
			duration["value"] = float64(v.Total)
			delete(duration, "formula")
		}
		if textValue(duration["kind"]) == "" {
			duration["kind"] = "manual"
		}
		e.Duration = duration
		filtered := []any{}
		for _, raw := range states {
			s := object(raw)
			if e.Concentration && s["concentration"] == true {
				continue
			}
			if e.Data["stacking"] != "multiple" && int64(number(s["effect_id"])) == e.ID {
				continue
			}
			filtered = append(filtered, raw)
		}
		states = append(filtered, map[string]any{"uid": fmt.Sprintf("application-%s-%d", uid, index), "effect_id": float64(e.ID), "duration": duration, "concentration": e.Concentration, "params": e.Params, "source": map[string]any{"kind": "potion", "item_id": float64(p.ItemID), "label": p.Name, "entry_key": uid, "link_key": e.Key}})
		r.Effects = append(r.Effects, e)
	}
	if len(p.Effects) > 0 {
		values["states"] = states
	}
	return r, nil
}
