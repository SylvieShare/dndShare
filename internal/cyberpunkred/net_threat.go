package cyberpunkred

import (
	"encoding/json"
	"fmt"
	"strconv"
)

func netD10(base int, die func(int) int) (int, []int) {
	d := die(10)
	dice := []int{d}
	total := base + d
	if d == 1 || d == 10 {
		n := die(10)
		dice = append(dice, n)
		if d == 1 {
			total -= n
		} else {
			total += n
		}
	}
	return total, dice
}

// The actor records known ICE; the GM still controls when that ICE attacks.
func netThreat(doc map[string]any, r RollRequest, facts map[string]map[string]any, die func(int) int) (json.RawMessage, RollResult, error) {
	result := RollResult{Title: r.Title, Dice: []int{}}
	fail := func(message string) (json.RawMessage, RollResult, error) {
		return nil, result, fmt.Errorf("%s", message)
	}
	v := object(doc["values"])
	net := object(v["netrunning"])
	if net["connected"] != true {
		return fail("Персонаж не подключён")
	}
	node := find(net["nodes"], "uid", r.TargetNodeUID)
	if node == nil || num(node["rez"]) <= 0 || node["attackedThisTurn"] == true {
		return fail("ЛЁД недоступен или уже атаковал в этом ходу")
	}
	f := facts[str(node["key"])]
	if len(f) == 0 {
		return fail("Выберите ЛЁД из справочника для автоматического эффекта")
	}
	rank := num(find(v["roles"], "key", "netrunner")["rank"])
	base := num(f["atk"])
	target := map[string]any(nil)
	if str(f["target"]) == "program" {
		active := []map[string]any{}
		for _, raw := range array(net["loadedPrograms"]) {
			p := object(raw)
			if p["active"] == true && num(p["rez"]) > 0 {
				active = append(active, p)
			}
		}
		if len(active) == 0 {
			return fail("Нет активных программ для атаки этого ЛЬДА")
		}
		target = active[die(len(active))-1]
		rank = num(facts[str(target["key"])]["defense"])
	} else {
		rank += activeBonuses(v, facts, "interface")["all-actions"]
		health := object(v["health"])
		if num(health["current"]) <= 0 {
			rank -= 4
		} else {
			stats := object(v["stats"])
			maximum := 10 + 5*((num(stats["BODY"])+num(stats["WILL"])+1)/2)
			if num(health["current"])*2 < maximum {
				rank -= 2
			}
		}
	}
	result.Total, result.Dice = netD10(base, die)
	if len(result.Dice) > 1 {
		result.Critical = "success"
		if result.Dice[0] == 1 {
			result.Critical = "failure"
		}
	}
	result.Base = base
	result.Expression = fmt.Sprintf("1d10%+d", base)
	opposed, dice := netD10(rank, die)
	result.OpponentTotal = &opposed
	result.OpponentDice = dice
	success := result.Total > opposed
	result.Success = &success
	node["attackedThisTurn"] = true
	if success {
		formula := str(f["damage"])
		if match := netDamageFormula.FindStringSubmatch(formula); match != nil {
			count, _ := strconv.Atoi(match[1])
			for i := 0; i < count; i++ {
				d := die(6)
				result.DamageDice = append(result.DamageDice, d)
				result.Damage += d
			}
		}
		if target != nil {
			target["rez"] = max(0, num(target["rez"])-result.Damage)
			if num(target["rez"]) == 0 {
				target["destroyed"] = true
				target["active"] = false
			}
			result.Effect = "Атакована программа: " + str(target["key"])
		} else {
			if str(node["key"]) == "ice-raven" {
				defenders := []map[string]any{}
				for _, raw := range array(net["loadedPrograms"]) {
					p := object(raw)
					if p["active"] == true && str(facts[str(p["key"])]["programClass"]) == "defender" {
						defenders = append(defenders, p)
					}
				}
				if len(defenders) > 0 {
					defenders[die(len(defenders))-1]["active"] = false
				}
			}
			if result.Damage > 0 {
				for _, raw := range array(net["loadedPrograms"]) {
					p := object(raw)
					if p["key"] == "program-armor" && p["active"] == true && num(p["rez"]) > 0 {
						result.Damage = max(0, result.Damage-4)
						break
					}
				}
				h := object(v["health"])
				if num(h["current"]) == 0 {
					h["deathSavePenalty"] = num(h["deathSavePenalty"]) + 1
				}
				h["current"] = max(0, num(h["current"])-result.Damage)
				h["stabilized"] = false
			}
			switch str(node["key"]) {
			case "ice-asp":
				programs := array(net["loadedPrograms"])
				if len(programs) > 0 {
					p := object(programs[die(len(programs))-1])
					p["destroyed"] = true
					p["active"] = false
					result.Effect = "Уничтожена программа: " + str(p["key"])
				}
			case "ice-giant":
				result.Effect = "Небезопасное отключение: ведущий применяет эффекты остальных преследующих ЛЬДОВ."
				net["connected"] = false
			case "ice-hellhound":
				result.Effect = "Без теплоизоляции добавьте горение 2 HP/ход до тушения."
			case "ice-kraken":
				net["immobilizedTurns"] = 2
				result.Effect = "На два хода запрещены движение и безопасное отключение."
			case "ice-lich", "ice-scorpion":
				n := die(6)
				keys := []string{"INT", "REF", "DEX"}
				if node["key"] == "ice-scorpion" {
					keys = []string{"MOVE"}
				}
				bonuses := []any{}
				for _, key := range keys {
					bonuses = append(bonuses, map[string]any{"target": "stat:" + key, "value": -min(n, max(0, num(object(v["stats"])[key])-1))})
				}
				h := object(v["health"])
				h["conditions"] = append(array(h["conditions"]), map[string]any{"uid": r.ActionID, "name": "Последствие Чёрного ЛЬДА", "duration": "1 час", "bonuses": bonuses})
			case "ice-wisp":
				net["nextActionPenalty"] = num(net["nextActionPenalty"]) + 1
			case "ice-skunk":
				node["slidePenalty"] = 2
			}
		}
	}
	next, err := json.Marshal(doc)
	return next, result, err
}
