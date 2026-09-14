package store

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strconv"

	"github.com/jackc/pgx/v5"
)

type ApplicationEffect struct {
	ID            int64          `json:"id"`
	Name          string         `json:"name"`
	Key           string         `json:"key"`
	Data          map[string]any `json:"data"`
	Duration      map[string]any `json:"duration"`
	Concentration bool           `json:"concentration"`
	Params        map[string]any `json:"params"`
}
type ApplicationPlan struct {
	maximumHP   *int
	Option      string              `json:"option,omitempty"`
	ItemID      int64               `json:"itemId"`
	Name        string              `json:"name"`
	Healing     string              `json:"healing,omitempty"`
	TemporaryHP string              `json:"temporaryHp,omitempty"`
	Effects     []ApplicationEffect `json:"effects"`
	Note        string              `json:"note,omitempty"`
}
type ApplicationResult struct {
	Healing     *ApplicationRoll    `json:"healing,omitempty"`
	TemporaryHP *ApplicationRoll    `json:"temporaryHp,omitempty"`
	Effects     []ApplicationEffect `json:"effects"`
	Note        string              `json:"note,omitempty"`
}

func object(v any) map[string]any {
	m, _ := v.(map[string]any)
	if m == nil {
		return map[string]any{}
	}
	return m
}
func array(v any) []any { a, _ := v.([]any); return a }
func number(v any) int {
	var f float64
	switch n := v.(type) {
	case float64:
		f = n
	case string:
		f, _ = strconv.ParseFloat(n, 64)
	case int:
		return n
	}
	if math.IsNaN(f) || math.IsInf(f, 0) || math.Abs(f) > 1e12 {
		return 0
	}
	return int(f)
}
func textValue(v any) string { s, _ := v.(string); return s }

func applicationItem(ctx context.Context, tx pgx.Tx, id int64) (string, map[string]any, int, error) {
	var name string
	var data json.RawMessage
	var kind int
	err := tx.QueryRow(ctx, `SELECT name,data,type_id FROM dndshare.item WHERE id=$1`, id).Scan(&name, &data, &kind)
	if err != nil {
		return "", nil, 0, err
	}
	var d map[string]any
	err = json.Unmarshal(data, &d)
	return name, d, kind, err
}

// Resolve and freeze catalogue mechanics when the dose is reserved. Editing a
// catalogue while an offer is pending must not change what the recipient accepts.
func buildPotionApplication(ctx context.Context, tx pgx.Tx, entry map[string]any, option string, userID int64) (ApplicationPlan, error) {
	p := ApplicationPlan{Option: option, ItemID: int64(number(entry["item_id"])), Effects: []ApplicationEffect{}}
	if p.ItemID == 0 {
		p.Name = textValue(object(entry["override"])["name"])
		p.Note = "Действие авторского зелья отмечается вручную."
		return p, nil
	}
	name, data, kind, err := visibleApplicationItem(ctx, tx, p.ItemID, userID)
	if err != nil {
		return p, err
	}
	if kind != 10 {
		return p, ErrApplication
	}
	p.Name = name
	c := object(data["consumption"])
	if choices := array(c["choices"]); len(choices) > 0 {
		found := false
		for _, raw := range choices {
			choice := object(raw)
			if textValue(choice["key"]) == option {
				merged := map[string]any{}
				for k, v := range c {
					merged[k] = v
				}
				for k, v := range choice {
					merged[k] = v
				}
				c = merged
				found = true
				break
			}
		}
		if !found {
			return p, fmt.Errorf("%w: выберите вариант зелья", ErrApplication)
		}
	}
	p.Healing = textValue(c["healing"])
	p.TemporaryHP = textValue(c["temporary_hp"])
	p.Note = textValue(c["note"])
	for _, f := range []string{p.Healing, p.TemporaryHP} {
		if f != "" {
			if _, err = rollApplication(f, func(int) (int, error) { return 1, nil }); err != nil {
				return p, err
			}
		}
	}
	links := array(data["status_effects"])
	if own, ok := c["status_effects"].([]any); ok {
		links = own
	}
	if id := int64(number(object(c["spell"])["id"])); id > 0 {
		_, spell, kind, e := visibleApplicationItem(ctx, tx, id, userID)
		if e != nil {
			return p, e
		}
		if kind != 5 {
			return p, ErrApplication
		}
		key := textValue(c["spell_effect_key"])
		matched := false
		for _, raw := range array(spell["status_effects"]) {
			link := object(raw)
			if key == "" || textValue(link["key"]) == key {
				links = append(links, raw)
				matched = true
			}
		}
		if !matched {
			return p, fmt.Errorf("%w: у заклинания нет выбранного эффекта", ErrApplication)
		}
	}
	if len(links) > 20 {
		return p, ErrApplication
	}
	for _, raw := range links {
		link := object(raw)
		id := int64(number(object(link["effect"])["id"]))
		name, effect, kind, e := visibleApplicationItem(ctx, tx, id, userID)
		if e != nil {
			return p, e
		}
		if kind != 15 {
			return p, ErrApplication
		}
		duration := object(effect["duration"])
		if d, ok := link["duration"].(map[string]any); ok {
			duration = d
		}
		if d, ok := c["duration"].(map[string]any); ok {
			duration = d
		}
		if e = validateApplicationDuration(duration); e != nil {
			return p, e
		}
		concentration := effect["concentration"] == true
		if v, ok := link["concentration"].(bool); ok {
			concentration = v
		}
		if v, ok := c["concentration"].(bool); ok {
			concentration = v
		}
		params := map[string]any{}
		for _, b := range array(link["parameter_bindings"]) {
			binding := object(b)
			if binding["source"] == "fixed" {
				params[textValue(binding["key"])] = binding["value"]
			}
		}
		p.Effects = append(p.Effects, ApplicationEffect{ID: id, Name: name, Key: textValue(link["key"]), Data: effect, Duration: duration, Concentration: concentration, Params: params})
	}
	if p.Healing == "" && p.TemporaryHP == "" && len(p.Effects) == 0 && p.Note == "" {
		p.Note = "Действие этого зелья отмечается вручную."
	}
	return p, nil
}

func visibleApplicationItem(ctx context.Context, tx pgx.Tx, id, userID int64) (string, map[string]any, int, error) {
	var visible bool
	err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM dndshare.item WHERE id=$1 AND (user_id IS NULL OR user_id=$2))`, id, userID).Scan(&visible)
	if err != nil {
		return "", nil, 0, err
	}
	if !visible {
		return "", nil, 0, ErrNotFound
	}
	return applicationItem(ctx, tx, id)
}
