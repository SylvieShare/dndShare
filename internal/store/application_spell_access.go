package store

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
)

// Granted spells are derived from the same owned abilities and active equipment
// as the sheet; clients cannot grant themselves an arbitrary catalogue spell.
func canUseApplicationSpell(ctx context.Context, tx pgx.Tx, values map[string]any, spellID int, grantOut ...*map[string]any) (bool, error) {
	if ownsApplicationSpell(values["spells"], spellID) {
		return true, nil
	}
	type source struct {
		id              int
		entry           map[string]any
		magic, equipped bool
	}
	sources := []source{}
	for _, field := range []string{"abilities_class", "abilities_race", "abilities_story", "abilities_feats"} {
		for _, raw := range array(values[field]) {
			e := object(raw)
			if e["requirements_met"] != false {
				sources = append(sources, source{id: number(e["id"])})
			}
		}
	}
	add := func(entries []any, equipped bool) {
		for _, raw := range entries {
			e := object(raw)
			id := number(e["magic_item_id"])
			if id == 0 {
				id = number(e["item_id"])
			}
			sources = append(sources, source{id: id, entry: e, magic: true, equipped: equipped})
		}
	}
	add(array(values["weapon"]), true)
	items := object(values["items"])
	add(array(items["equipped"]), true)
	for _, raw := range array(items["sections"]) {
		add(array(object(raw)["items"]), false)
	}
	for _, s := range sources {
		if s.id <= 0 {
			continue
		}
		_, data, kind, err := applicationItem(ctx, tx, int64(s.id))
		if errors.Is(err, pgx.ErrNoRows) {
			continue
		}
		if err != nil {
			return false, err
		}
		level := applicationOwnerLevel(data, values)
		if level < max(1, number(data["level"])) {
			continue
		}
		if s.magic {
			magic := object(object(s.entry["params"])["magic"])
			if kind != 19 || magic["lost"] == true || s.entry["count"] != nil && number(s.entry["count"]) <= 0 || data["activation"] != "carried" && !s.equipped || data["attunement"] != "none" && magic["attuned"] != true {
				continue
			}
		}
		for _, raw := range array(data["granted_spells"]) {
			grant := object(raw)
			id := number(grant["spell"])
			if id == 0 {
				id = number(object(grant["spell"])["id"])
			}
			if id == spellID && level >= max(1, number(grant["level"])) {
				if len(grantOut) > 0 {
					*grantOut[0] = grant
				}
				return true, nil
			}
		}
	}
	return false, nil
}
