package store

import (
	"context"
	"github.com/jackc/pgx/v5"
)

func applicationOwnerLevel(data, values map[string]any) int {
	level := number(object(values["lvl"])["level"])
	mode := textValue(data["level_source"])
	if mode == "character" {
		return level
	}
	ids := map[int]bool{}
	subs := map[int]bool{}
	if mode == "class" {
		id := number(data["level_class_id"])
		if id == 0 {
			id = number(object(data["level_class_id"])["id"])
		}
		ids[id] = true
		subs[id] = true
	} else {
		for _, v := range array(data["class_ids"]) {
			id := number(v)
			if id == 0 {
				id = number(object(v)["id"])
			}
			ids[id] = true
		}
		for _, v := range array(data["subclass_ids"]) {
			id := number(v)
			if id == 0 {
				id = number(object(v)["id"])
			}
			subs[id] = true
		}
	}
	if len(ids)+len(subs) == 0 {
		return level
	}
	classes := array(values["classes"])
	found := 0
	for _, v := range classes {
		c := object(v)
		if ids[number(c["id"])] || subs[number(object(c["subclass"])["id"])] {
			if len(classes) == 1 && level > 0 {
				return level
			}
			found = max(found, number(c["level"]))
		}
	}
	return found
}

// Mirror the sheet's hp_bonuses contract, including class level and active
// magic equipment. The cap is calculated from the locked recipient document.
func applicationHPMaximum(ctx context.Context, tx pgx.Tx, values map[string]any) (int, error) {
	hp := object(values["hp"])
	maximum := number(hp["max"])
	if m, ok := hp["max"].(map[string]any); ok {
		maximum = number(m["base"])
		for _, b := range array(m["bonuses"]) {
			maximum += number(object(b)["value"])
		}
	}
	type candidate struct {
		id       int64
		magic    bool
		equipped bool
		entry    map[string]any
	}
	candidates := []candidate{}
	for _, field := range []string{"abilities_race", "abilities_class", "abilities_story", "abilities_feats"} {
		for _, v := range array(values[field]) {
			e := object(v)
			if field == "abilities_feats" && e["requirements_met"] == false {
				continue
			}
			candidates = append(candidates, candidate{id: int64(number(e["id"]))})
		}
	}
	add := func(entries []any, equipped bool) {
		for _, v := range entries {
			e := object(v)
			id := number(e["magic_item_id"])
			if id == 0 {
				id = number(e["item_id"])
			}
			if id > 0 {
				candidates = append(candidates, candidate{int64(id), true, equipped, e})
			}
		}
	}
	add(array(values["weapon"]), true)
	items := object(values["items"])
	add(array(items["equipped"]), true)
	for _, s := range array(items["sections"]) {
		add(array(object(s)["items"]), false)
	}
	for _, c := range candidates {
		if c.id <= 0 {
			continue
		}
		_, data, kind, err := applicationItem(ctx, tx, c.id)
		if err != nil {
			return 0, err
		}
		level := applicationOwnerLevel(data, values)
		if c.magic {
			magic := object(object(c.entry["params"])["magic"])
			if kind != 19 || magic["lost"] == true || c.entry["count"] != nil && number(c.entry["count"]) <= 0 || data["activation"] != "carried" && !c.equipped || data["attunement"] != "none" && magic["attuned"] != true || level < max(1, number(data["level"])) {
				continue
			}
		}
		for _, v := range array(data["hp_bonuses"]) {
			r := object(v)
			if level >= max(1, number(r["level"])) {
				maximum += number(r["base"]) + level*number(r["per_level"])
			}
		}
	}
	return max(0, maximum), nil
}

func applyApplicationTx(ctx context.Context, tx pgx.Tx, doc transferDocument, p ApplicationPlan, uid string) (ApplicationResult, error) {
	if err := prepareSpellHealing(ctx, tx, &p); err != nil {
		return ApplicationResult{}, err
	}
	if p.Healing != "" {
		maximum, err := applicationHPMaximum(ctx, tx, doc.values())
		if err != nil {
			return ApplicationResult{}, err
		}
		p.maximumHP = &maximum
	}
	return applyApplication(doc, p, uid, secureApplicationDie)
}
