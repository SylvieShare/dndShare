package store

import (
	"context"
	"github.com/jackc/pgx/v5"
)

type applicationRuleSource struct {
	Data, Entry map[string]any
	Level       int
}

func applicationRuleSources(ctx context.Context, tx pgx.Tx, values map[string]any) ([]applicationRuleSource, error) {
	sources := []applicationRuleSource{}
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
			candidates = append(candidates, candidate{id: int64(number(e["id"])), entry: e})
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
			return nil, err
		}
		level := applicationOwnerLevel(data, values)
		if c.magic {
			magic := object(object(c.entry["params"])["magic"])
			if kind != 19 || magic["lost"] == true || c.entry["count"] != nil && number(c.entry["count"]) <= 0 || data["activation"] != "carried" && !c.equipped || data["attunement"] != "none" && magic["attuned"] != true || level < max(1, number(data["level"])) {
				continue
			}
		}
		sources = append(sources, applicationRuleSource{data, c.entry, level})
	}
	return sources, nil
}
