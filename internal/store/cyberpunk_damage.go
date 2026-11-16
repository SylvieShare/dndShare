package store

import (
	"context"
	"dndshare/internal/cyberpunkred"
	"encoding/json"
	"fmt"
	"github.com/jackc/pgx/v5"
	"math"
)

type RedDamageOptions struct {
	IgnoreSPBelow int    `json:"ignoreSPBelow"`
	AblationOnly  bool   `json:"ablationOnly"`
	Location      string `json:"location"`
	ArmorMode     string `json:"armorMode"`
	Critical      bool   `json:"critical"`
	Ablation      *int   `json:"ablation"`
	Nonlethal     bool   `json:"nonlethal"`
}

func applyRedImpact(ctx context.Context, tx pgx.Tx, doc transferDocument, charID int64, parts []ImpactDamage, options *RedDamageOptions) (ImpactResult, error) {
	v := doc.values()
	hp := object(v["health"])
	stats := object(v["stats"])
	if len(hp) == 0 || len(stats) == 0 {
		return ImpactResult{}, ErrApplication
	}
	opt := RedDamageOptions{Location: "body", ArmorMode: "full"}
	if options != nil {
		opt = *options
		if opt.Location == "" {
			opt.Location = "body"
		}
		if opt.ArmorMode == "" {
			opt.ArmorMode = "full"
		}
	}
	if (opt.Location != "head" && opt.Location != "body") || (opt.ArmorMode != "full" && opt.ArmorMode != "half" && opt.ArmorMode != "ignore") {
		return ImpactResult{}, ErrApplication
	}
	ablation := 1
	if opt.Ablation != nil {
		ablation = *opt.Ablation
	}
	if ablation < 0 || ablation > 10 {
		return ImpactResult{}, ErrApplication
	}
	type layer struct {
		entry map[string]any
		sp    int
	}
	layers := []layer{}
	protection := max(0, number(object(v["npcArmor"])[opt.Location]))
	for _, value := range array(object(v["inventory"])["entries"]) {
		e := object(value)
		if e["equipped"] != true {
			continue
		}
		var raw json.RawMessage
		err := tx.QueryRow(ctx, `SELECT data FROM dndshare.active_item WHERE ((data->>'red_key'=$1 AND user_id IS NULL) OR (id=$2 AND $1='custom-'||id::text AND user_id=(SELECT user_id FROM dndshare."char" WHERE id=$3))) LIMIT 1`, textValue(e["key"]), number(e["itemId"]), charID).Scan(&raw)
		if err == pgx.ErrNoRows {
			continue
		}
		if err != nil {
			return ImpactResult{}, err
		}
		var item map[string]any
		if json.Unmarshal(raw, &item) != nil {
			return ImpactResult{}, ErrApplication
		}
		f := object(item["facts"])
		sp := number(f[opt.Location+"SP"])
		if sp > 0 {
			sp = max(0, sp-number(object(e["ablation"])[opt.Location]))
			layers = append(layers, layer{e, sp})
			protection = max(protection, sp)
		}
	}
	for _, value := range array(object(v["cyberware"])["installations"]) {
		e := object(value)
		key := textValue(e["key"])
		sp := 0
		if key == "cyberware-skin-weave" {
			sp = 7
		}
		if key == "cyberware-subdermal-armor" {
			sp = 11
		}
		if sp > 0 {
			sp = max(0, sp-number(object(e["ablation"])[opt.Location]))
			layers = append(layers, layer{e, sp})
			protection = max(protection, sp)
		}
	}
	maximum := cyberpunkred.MaximumHP(v)
	if number(v["npcHPMax"]) > 0 {
		maximum = number(v["npcHPMax"])
	}
	result := ImpactResult{Before: ImpactHP{Current: max(0, number(hp["current"])), Max: maximum}, Multiplier: 1, Damage: []ImpactDamage{}}
	if opt.ArmorMode == "half" {
		protection = int(math.Ceil(float64(protection) / 2))
	}
	if opt.ArmorMode == "ignore" {
		protection = 0
	}
	if opt.IgnoreSPBelow > 0 {
		original := protection
		if opt.ArmorMode == "half" {
			original = 0
			for _, l := range layers {
				original = max(original, l.sp)
			}
		}
		if original < opt.IgnoreSPBelow {
			protection = 0
		}
	}
	rawDamage := 0
	for _, part := range parts {
		if part.Amount < 0 {
			return result, ErrApplication
		}
		rawDamage += part.Amount
		result.Damage = append(result.Damage, part)
	}
	combat := object(v["combat"])
	if combat["damageDeflectionUsed"] != true && opt.ArmorMode != "ignore" {
		for _, raw := range array(v["roles"]) {
			role := object(raw)
			if role["key"] == "solo" {
				deflection := number(object(role["choices"])["damageDeflection"])
				if deflection > 0 && rawDamage > 0 {
					rawDamage = max(0, rawDamage-deflection)
					combat["damageDeflectionUsed"] = true
					v["combat"] = combat
				}
			}
		}
	}
	penetrating := max(0, rawDamage-protection)
	total := penetrating
	if opt.Location == "head" {
		multiplier := 2
		for _, raw := range array(hp["injuries"]) {
			if object(raw)["key"] == "criticalinjury-cracked-skull" {
				multiplier = 3
			}
		}
		total *= multiplier
	}
	if opt.Critical && !opt.Nonlethal {
		total += 5
	}
	minimum := 0
	if opt.Nonlethal {
		minimum = min(1, result.Before.Current)
	}
	result.After = ImpactHP{Current: max(minimum, result.Before.Current-total), Max: maximum}
	result.Total = total
	result.HPLost = result.Before.Current - result.After.Current
	result.Absorbed = min(rawDamage, protection)
	for i := range result.Damage {
		result.Damage[i].Applied = 0
		result.Damage[i].Defense = fmt.Sprintf("SP %d", protection)
	}
	if len(result.Damage) > 0 {
		result.Damage[0].Applied = total
	}
	if (penetrating > 0 || opt.AblationOnly) && opt.ArmorMode != "ignore" && !opt.Nonlethal {
		if armor := object(v["npcArmor"]); len(armor) > 0 {
			armor[opt.Location] = max(0, number(armor[opt.Location])-ablation)
		}
		for _, l := range layers {
			state := object(l.entry["ablation"])
			state[opt.Location] = number(state[opt.Location]) + ablation
			l.entry["ablation"] = state
		}
	}
	if result.Before.Current == 0 && total > 0 {
		hp["deathSavePenalty"] = number(hp["deathSavePenalty"]) + 1
	}
	hp["current"] = result.After.Current
	if total > 0 {
		hp["stabilized"] = false
	}
	v["health"] = hp
	return result, nil
}
