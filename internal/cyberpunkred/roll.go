package cyberpunkred

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"
)

type RollRequest struct {
	Distance      *int   `json:"distance,omitempty"`
	Location      string `json:"location,omitempty"`
	TargetNodeUID string `json:"targetNodeUid"`
	TargetType    string `json:"targetType"`
	Version       int64  `json:"version"`
	ActionID      string `json:"actionId"`
	SessionUUID   string `json:"sessionUuid"`
	Kind          string `json:"kind"`
	Title         string `json:"title"`
	SkillKey      string `json:"skillKey"`
	SkillUID      string `json:"skillUid"`
	EntryUID      string `json:"entryUid"`
	RoleKey       string `json:"roleKey"`
	StatKey       string `json:"statKey"`
	Modifier      int    `json:"modifier"`
	Luck          int    `json:"luck"`
	DV            *int   `json:"dv"`
	Mode          string `json:"mode"`
}
type RollResult struct {
	DiceSides     int            `json:"diceSides,omitempty"`
	DamageOptions map[string]any `json:"damageOptions,omitempty"`
	DV            *int           `json:"dv,omitempty"`
	OpponentDice  []int          `json:"opponentDice,omitempty"`
	OpponentTotal *int           `json:"opponentTotal,omitempty"`
	Damage        int            `json:"damage,omitempty"`
	DamageDice    []int          `json:"damageDice,omitempty"`
	Effect        string         `json:"effect,omitempty"`
	Total         int            `json:"total"`
	Base          int            `json:"base"`
	Dice          []int          `json:"dice"`
	Success       *bool          `json:"success,omitempty"`
	Critical      string         `json:"critical,omitempty"`
	Expression    string         `json:"expression"`
	Title         string         `json:"title"`
	AmmoSpent     int            `json:"ammoSpent"`
	LuckSpent     int            `json:"luckSpent"`
}

func object(v any) map[string]any {
	m, _ := v.(map[string]any)
	if m == nil {
		return map[string]any{}
	}
	return m
}
func array(v any) []any { a, _ := v.([]any); return a }
func num(v any) int {
	switch n := v.(type) {
	case float64:
		return int(n)
	case int:
		return n
	case int64:
		return int(n)
	}
	return 0
}
func str(v any) string { s, _ := v.(string); return s }
func find(a any, key, value string) map[string]any {
	for _, v := range array(a) {
		m := object(v)
		if str(m[key]) == value {
			return m
		}
	}
	return nil
}

// Resolve uses saved actor data and catalogue parameters, never client skill totals.
// The caller commits the returned document and receipt together.
func Resolve(raw json.RawMessage, r RollRequest, facts map[string]map[string]any, die func(int) int) (json.RawMessage, RollResult, error) {
	var doc map[string]any
	result := RollResult{Title: r.Title, Dice: []int{}}
	bad := func(message string) (json.RawMessage, RollResult, error) {
		return nil, result, fmt.Errorf("%s", message)
	}
	if json.Unmarshal(raw, &doc) != nil || doc["system"] != "cyberpunk-red" {
		return bad("Это не персонаж Cyberpunk RED")
	}
	if r.Version < 0 || len(r.Title) > 255 || r.Modifier < -100 || r.Modifier > 100 || r.Luck < 0 || r.Luck > 20 || (r.DV != nil && (*r.DV < -100 || *r.DV > 200)) {
		return bad("Недопустимые параметры броска")
	}
	v := object(doc["values"])
	stats := object(v["stats"])
	health := object(v["health"])
	luck := object(v["luck"])
	if health["dead"] == true {
		return bad("Персонаж погиб")
	}
	if r.Kind == "damage" {
		return attackDamage(doc, r, facts, die)
	}
	if r.Kind == "injury" {
		return rollInjury(doc, r, die)
	}
	if r.Kind == "net-threat" {
		return netThreat(doc, r, facts, die)
	}
	bonuses := activeBonuses(v, facts, r.Kind)
	if r.Luck > num(luck["current"]) {
		return bad("Не хватает удачи")
	}
	effective := map[string]int{}
	for k, x := range stats {
		n := num(x)
		if n < 0 || n > 100 {
			return bad("Некорректная характеристика")
		}
		effective[k] = n
	}
	for key := range effective {
		if key != "BODY" {
			minimum := 0
			if key == "MOVE" && bonuses["stat:"+key] < 0 {
				minimum = 1 // Injury/NET loss precedes armor, which can immobilize at zero.
			}
			effective[key] = max(minimum, effective[key]+bonuses["stat:"+key])
		}
	}
	lace, frame := 0, 0
	for _, value := range array(object(v["cyberware"])["installations"]) {
		e := object(value)
		if e["disabled"] == true {
			continue
		}
		switch str(e["key"]) {
		case "cyberware-grafted-muscle-and-bone-lace":
			lace++
		case "cyberware-implanted-linear-frame-sigma":
			frame = max(frame, 12)
		case "cyberware-implanted-linear-frame-beta":
			frame = max(frame, 14)
		}
	}
	if lace > 0 {
		effective["BODY"] = min(10, effective["BODY"]+lace*2)
	}
	effective["BODY"] = max(effective["BODY"], frame)
	effective["EMP"] = max(0, min(effective["EMP"], int(math.Floor(float64(num(object(v["humanity"])["current"]))/10))))
	penalty := 0
	entries := array(object(v["inventory"])["entries"])
	for _, entry := range entries {
		e := object(entry)
		if e["equipped"] == true {
			f := facts[str(e["key"])]
			penalty = max(penalty, int(math.Abs(float64(num(f["penalty"])))))
		}
	}
	for _, key := range []string{"REF", "DEX", "MOVE"} {
		effective[key] = max(0, effective[key]-penalty)
	}
	roleRank := func(key string) int { entry := find(v["roles"], "key", key); return num(entry["rank"]) }
	extraRoll := true
	base := r.Modifier + r.Luck
	solo := object(find(v["roles"], "key", "solo")["choices"])
	switch r.Kind {
	case "medicine", "manufacture-medicine":
		bonus, err := medicineCheck(v, &r)
		if err != nil {
			return nil, result, err
		}
		base += bonus
	case "check":
		core, _ := Core()
		stat := ""
		for _, skill := range core.Dictionaries["Навыки"] {
			if skill.Key == r.SkillKey {
				stat = strings.Split(skill.Description, ";")[0]
				break
			}
		}
		if stat == "" {
			return bad("Неизвестный навык")
		}
		skill := find(v["skills"], "uid", r.SkillUID)
		if r.SkillUID != "" && (skill == nil || str(skill["key"]) != r.SkillKey) {
			return bad("Навык не принадлежит персонажу")
		}
		base += effective[stat] + num(skill["rank"])
		base += bonuses[r.SkillKey]
		if r.SkillKey == "perception" {
			base += num(solo["threatDetection"]) + bonuses["perception-hearing"] + bonuses["perception-sight"]
		}
		if r.SkillKey == "trading" {
			base += roleRank("fixer")
		}
		if strings.Contains("|drive-land-vehicle|pilot-air-vehicle|pilot-sea-vehicle|air-vehicle-tech|land-vehicle-tech|sea-vehicle-tech|", "|"+r.SkillKey+"|") {
			base += roleRank("nomad")
		}
		if strings.HasPrefix(r.Mode, "tech:") {
			choice := strings.TrimPrefix(r.Mode, "tech:")
			if !strings.Contains("|field|upgrade|fabrication|invention|", "|"+choice+"|") || roleRank("tech") == 0 {
				return bad("Недоступная специальность Техника")
			}
			if !strings.Contains("|basic-tech|cybertech|electronics-security-tech|weaponstech|air-vehicle-tech|land-vehicle-tech|sea-vehicle-tech|", "|"+r.SkillKey+"|") {
				return bad("Выберите технический навык")
			}
			base += num(object(find(v["roles"], "key", "tech")["choices"])[choice])
		}
	case "initiative":
		base += effective["REF"]
		base += num(solo["initiative"]) + bonuses["initiative"]
	case "death":
		base = r.Modifier + num(health["deathSavePenalty"])
		for _, injury := range array(health["injuries"]) {
			base += num(facts[str(object(injury)["key"])]["deathPenalty"])
		}
		extraRoll = false
		if r.Luck != 0 {
			return bad("Удача недоступна для проверки смерти")
		}
	case "role":
		if r.RoleKey != "rockerboy" && r.RoleKey != "lawman" && !(r.RoleKey == "media" && r.Mode == "publication") {
			return bad("Эта роль использует навыки или специальные действия")
		}
		rank := roleRank(r.RoleKey)
		if rank == 0 {
			return bad("Нет этой роли")
		}
		base += rank
		if r.RoleKey == "media" {
			if r.Luck != 0 || r.Modifier < 0 || r.Modifier > 3 {
				return bad("Достоверность: без удачи, бонус доказательств 0–3")
			}
			base = 0
			extraRoll = false
		}
		if r.RoleKey == "lawman" {
			if r.Modifier != 0 || r.Luck != 0 {
				return bad("Подкрепление использует немодифицированный d10")
			}
			base = r.Modifier
			extraRoll = false
		}
	case "interface":
		bonus, err := prepareNetCheck(v, &r, facts, &result, die)
		if err != nil {
			return nil, result, err
		}
		base += bonus
	case "attack":
		bonus, err := prepareAttack(v, &r, facts, effective, bonuses, solo, &result)
		if err != nil {
			return nil, result, err
		}
		base += bonus
	default:
		return bad("Неизвестный тип броска")
	}
	if r.Kind != "initiative" && r.Kind != "death" && !(r.Kind == "role" && (r.RoleKey == "lawman" || r.RoleKey == "media")) {
		base += bonuses["all-actions"]
		maximum := MaximumHP(v)
		if num(health["current"]) <= 0 {
			base -= 4
		} else if num(health["current"]) < int(math.Ceil(float64(maximum)/2)) && bonuses["pain-suppression"] <= 0 {
			base -= 2
		}
	}
	first := die(10)
	if first < 1 || first > 10 {
		return bad("Ошибка генератора кубиков")
	}
	result.Dice = append(result.Dice, first)
	result.Base = base
	result.Total = base + first
	if extraRoll && (first == 1 || first == 10) && !(r.Kind == "attack" && first == 1 && num(solo["fumbleRecovery"]) > 0) {
		second := die(10)
		if second < 1 || second > 10 {
			return bad("Ошибка генератора кубиков")
		}
		result.Dice = append(result.Dice, second)
		if first == 1 {
			result.Total -= second
			result.Critical = "failure"
		} else {
			result.Total += second
			result.Critical = "success"
		}
	}
	if r.Kind == "attack" && first == 1 && num(solo["fumbleRecovery"]) == 0 {
		entry := find(object(v["inventory"])["entries"], "uid", r.EntryUID)
		if str(facts[str(entry["key"])]["quality"]) == "poor" {
			entry["jammed"] = true
		}
	}
	if r.Kind == "attack" {
		entry := find(object(v["inventory"])["entries"], "uid", r.EntryUID)
		state := map[string]any{"mode": r.Mode, "total": result.Total, "actionId": r.ActionID, "damageResolved": false}
		state["location"] = r.Location
		state["ammoKey"] = str(find(object(v["inventory"])["entries"], "uid", str(entry["ammoUid"]))["key"])
		state["body"] = effective["BODY"]
		if r.DV != nil {
			state["dv"] = *r.DV
			state["margin"] = result.Total - *r.DV
		}
		entry["lastAttack"] = state
	}
	if r.Kind == "death" {
		success := first != 10 && result.Total < effective["BODY"]
		result.Success = &success
		health["deathSavePenalty"] = num(health["deathSavePenalty"]) + 1
		if !success {
			health["dead"] = true
		}
	}
	if r.Kind == "role" && r.RoleKey == "lawman" {
		success := result.Total <= roleRank("lawman")
		result.Success = &success
		if success {
			arrival := die(6)
			result.Effect = fmt.Sprintf("Подкрепление прибудет через %d раундов.", arrival)
			if arrival == 6 {
				result.Effect += " Приходит следующая категория подкрепления; на ранге 10 — две группы."
			}
		}
	} else if r.Kind == "role" && r.RoleKey == "media" {
		rank := roleRank("media")
		threshold := (rank+1)/2 + 1
		if rank == 10 {
			threshold = 7
		}
		success := first <= threshold+r.Modifier
		result.Success = &success
		result.Effect = fmt.Sprintf("Публикации верят при d10 ≤ %d. Последствия определяет ведущий.", threshold+r.Modifier)
	} else if r.DV != nil && r.Kind != "death" {
		success := result.Total > *r.DV
		if r.Kind == "interface" && r.Mode == "speed" {
			success = result.Total >= *r.DV
		}
		result.Success = &success
	}
	luck["current"] = num(luck["current"]) - r.Luck
	result.LuckSpent = r.Luck
	result.Expression = fmt.Sprintf("1d10%+d", base)
	result.DV = r.DV
	if r.Kind == "interface" {
		netOutcome(v, r, facts, &result, die)
	}
	if r.Kind == "manufacture-medicine" {
		medicineOutcome(v, r, &result)
	}
	next, err := json.Marshal(doc)
	return next, result, err
}
