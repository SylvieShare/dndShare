package store

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/jackc/pgx/v5"
	"math"
	"strings"
)

func spellCastingReference(values map[string]any, id int64, key string) (map[string]any, int) {
	book := object(values["spells"])
	for _, raw := range array(book["tabs"]) {
		tab := object(raw)
		for _, v := range array(tab["spells"]) {
			entry := object(v)
			if number(entry["id"]) == int(id) && (key == "" || textValue(entry["key"]) == key) {
				ability := number(entry["casting_ability"])
				if ability == 0 {
					ability = number(tab["casting_ability"])
				}
				return entry, ability
			}
		}
	}
	for _, raw := range array(book["grants"]) {
		entry := object(raw)
		if number(entry["id"]) == int(id) && (key == "" || textValue(entry["key"]) == key) {
			return entry, number(entry["casting_ability"])
		}
	}
	return nil, 0
}
func spellAbilityModifier(values map[string]any, ability int) int {
	if ability < 1 || ability > 6 {
		return 0
	}
	if v, ok := object(values["stats"])[fmt.Sprint(ability)]; ok {
		return number(v)
	}
	key := []string{"STR", "DEX", "CON", "INT", "WIS", "CHA"}[ability-1]
	raw := object(values[key])["value"]
	score := number(raw)
	if data, ok := raw.(map[string]any); ok {
		score = number(data["base"])
		for _, b := range array(data["bonuses"]) {
			score += number(object(b)["value"])
		}
	}
	if raw == nil {
		score = 10
	}
	return int(math.Floor(float64(score-10) / 2))
}
func spellHealFormula(data, values map[string]any, level, ability int) string {
	heal := object(data["heal"])
	steps := 0
	base := number(data["lvl"])
	if heal["scaling"] == "slot" {
		steps = max(0, level-base) / max(1, number(heal["scaling_step"]))
		if rows := array(heal["scaling_levels"]); len(rows) > 0 {
			steps = 0
			for _, r := range rows {
				if level >= number(object(r)["level"]) {
					steps++
				}
			}
		}
		if n, ok := heal["scaling_max_steps"]; ok {
			steps = min(steps, max(0, number(n)))
		}
	}
	if heal["scaling"] == "cantrip" {
		hero := number(object(values["lvl"])["level"])
		for _, n := range []int{5, 11, 17} {
			if hero >= n {
				steps++
			}
		}
	}
	parts := []string{}
	bonus := 0
	add := func(rows []any, times int) {
		for _, r := range rows {
			row := object(r)
			count := max(1, number(row["count"])) * times
			die := textValue(row["dice_id"])
			if die != "" && count > 0 {
				parts = append(parts, fmt.Sprintf("%d%s", count, die))
			}
			bonus += number(row["bonus"]) * times
		}
	}
	add(array(heal["dices"]), 1)
	add(array(heal["addon"]), steps)
	if heal["add_mod"] == true {
		bonus += spellAbilityModifier(values, ability)
	}
	formula := strings.Join(parts, "+")
	if bonus > 0 {
		formula += fmt.Sprintf("+%d", bonus)
	} else if bonus < 0 {
		formula += fmt.Sprint(bonus)
	}
	return strings.TrimPrefix(formula, "+")
}
func spendSpellSlot(doc transferDocument, pool string, level int) error {
	if pool != "long_rest" && pool != "short_rest" {
		return ErrApplication
	}
	for _, raw := range array(object(object(doc.values()["spells"])["slot_pools"])[pool]) {
		slot := object(raw)
		if number(slot["level"]) == level && number(slot["used"]) < number(slot["total"]) {
			slot["used"] = number(slot["used"]) + 1
			return nil
		}
	}
	return fmt.Errorf("%w: нет доступной ячейки выбранного круга", ErrApplication)
}

// All targets of one healing spell share a roll. Generate it on the first
// acceptance, under the graph lock, and reuse it for subsequent recipients.
func prepareSpellHealing(ctx context.Context, tx pgx.Tx, p *ApplicationPlan) error {
	if p.CastID == "" || p.Healing == "" {
		return nil
	}
	var raw json.RawMessage
	if err := tx.QueryRow(ctx, `SELECT healing_roll FROM dndshare.spell_cast_receipt WHERE cast_id=$1::uuid`, p.CastID).Scan(&raw); err != nil {
		return err
	}
	var roll ApplicationRoll
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &roll); err != nil {
			return err
		}
	} else {
		var err error
		roll, err = rollApplication(p.Healing, secureApplicationDie)
		if err != nil {
			return err
		}
		raw, _ = json.Marshal(roll)
		if _, err = tx.Exec(ctx, `UPDATE dndshare.spell_cast_receipt SET healing_roll=CAST($2 AS jsonb) WHERE cast_id=$1::uuid`, p.CastID, raw); err != nil {
			return err
		}
	}
	p.healingRoll = &roll
	return nil
}
