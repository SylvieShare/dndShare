package cyberpunkred

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

func prepareNetCheck(v map[string]any, r *RollRequest, facts map[string]map[string]any, result *RollResult, die func(int) int) (int, error) {
	if r.Mode == "" {
		r.Mode = "backdoor"
	}
	if !strings.Contains("|scanner|backdoor|cloak|control|eyedee|pathfinder|slide|virus|zap|speed|program|", "|"+r.Mode+"|") {
		return 0, fmt.Errorf("Неизвестная функция Интерфейса")
	}
	role := find(v["roles"], "key", "netrunner")
	rank := num(role["rank"])
	if rank < 1 {
		return 0, fmt.Errorf("Нет Интерфейса")
	}
	if r.Mode == "scanner" {
		return rank, nil
	}
	net := object(v["netrunning"])
	if net["connected"] != true {
		return 0, fmt.Errorf("Сначала подключитесь к архитектуре")
	}
	cost := 1
	if r.Mode == "speed" {
		cost = 0
	}
	if r.Mode == "virus" {
		project := object(net["virus"])
		current := find(net["nodes"], "uid", str(net["nodeUid"]))
		if current == nil {
			return 0, fmt.Errorf("Сначала выберите нижний узел архитектуры")
		}
		for _, raw := range array(net["nodes"]) {
			if str(object(raw)["parentUid"]) == str(current["uid"]) {
				return 0, fmt.Errorf("Вирус размещается только в нижнем узле")
			}
		}
		if num(project["required"]) > 0 && num(project["spent"]) >= num(project["required"]) {
			cost = 0
			project["spent"] = 0
		} else {
			return 0, fmt.Errorf("Сначала вложите требуемые NET-действия в вирус")
		}
	}
	if num(net["actionsRemaining"]) < cost {
		return 0, fmt.Errorf("NET-действия исчерпаны")
	}
	net["actionsRemaining"] = num(net["actionsRemaining"]) - cost
	if r.Mode == "slide" {
		for _, raw := range array(net["nodes"]) {
			node := object(raw)
			if num(node["rez"]) > 0 {
				rank -= num(node["slidePenalty"])
			}
		}
		if net["slideUsed"] == true {
			return 0, fmt.Errorf("Ускользнуть можно один раз за ход")
		}
		net["slideUsed"] = true
	}
	if r.Mode == "program" {
		program := find(net["loadedPrograms"], "uid", r.EntryUID)
		if program == nil || program["usedThisTurn"] == true {
			return 0, fmt.Errorf("Программа уже использована в этом ходу")
		}
		f := facts[str(program["key"])]
		class := str(f["programClass"])
		if !strings.HasSuffix(class, "attacker") {
			return 0, fmt.Errorf("Выберите атакующую программу")
		}
		if (num(f["rez"]) > 0 && num(program["rez"]) <= 0) || program["destroyed"] == true {
			return 0, fmt.Errorf("Программа недоступна")
		}
		if str(program["key"]) == "program-superglue" && program["usedThisRun"] == true {
			return 0, fmt.Errorf("Эта программа уже использована в NET-сцене")
		}
		if r.TargetType == "" {
			if class == "antiprogramattacker" {
				r.TargetType = "blackIce"
			} else {
				r.TargetType = "netrunner"
			}
		}
		if class == "antiprogramattacker" && r.TargetType == "netrunner" || class == "antipersonnelattacker" && r.TargetType != "netrunner" {
			return 0, fmt.Errorf("Программа не действует на выбранный тип цели")
		}
		rank += num(f["atk"])
		program["usedThisTurn"] = true
		program["usedThisRun"] = true
		program["active"] = false
	}
	for _, value := range array(net["loadedPrograms"]) {
		p := object(value)
		if p["active"] != true || num(p["rez"]) <= 0 {
			continue
		}
		for _, raw := range array(facts[str(p["key"])]["bonuses"]) {
			b := object(raw)
			if str(b["target"]) == "net:"+r.Mode {
				rank += num(b["value"])
			}
		}
	}
	if r.TargetNodeUID != "" {
		node := find(net["nodes"], "uid", r.TargetNodeUID)
		if node == nil {
			return 0, fmt.Errorf("Неизвестный узел")
		}
		if (r.Mode == "slide" || r.Mode == "speed") && str(node["type"]) != "blackIce" {
			return 0, fmt.Errorf("Эта функция применяется только к Чёрному ЛЬДУ")
		}
		if r.Mode == "program" || r.Mode == "zap" {
			if !strings.Contains("|blackIce|program|demon|", "|"+str(node["type"])+"|") {
				return 0, fmt.Errorf("Выберите программу, Демона или Чёрный ЛЁД")
			}
			if str(node["type"]) == "blackIce" {
				r.TargetType = "blackIce"
			} else {
				r.TargetType = "program"
			}
			if r.Mode == "program" {
				p := find(net["loadedPrograms"], "uid", r.EntryUID)
				if str(facts[str(p["key"])]["programClass"]) == "antipersonnelattacker" {
					return 0, fmt.Errorf("Противопехотная программа не атакует ЛЁД или Демона")
				}
			}
		}
		dv := num(node["dv"])
		if r.Mode == "program" || r.Mode == "zap" || r.Mode == "slide" || r.Mode == "speed" {
			stat := "defense"
			if r.Mode == "slide" {
				stat = "perception"
			}
			if r.Mode == "speed" {
				stat = "speed"
			}
			if str(node["type"]) == "demon" {
				stat = "interface"
			}
			d := die(10)
			result.OpponentDice = []int{d}
			dv = num(node[stat]) + d
			if d == 1 || d == 10 {
				extra := die(10)
				result.OpponentDice = append(result.OpponentDice, extra)
				if d == 1 {
					dv -= extra
				} else {
					dv += extra
				}
			}
			result.OpponentTotal = &dv
		}
		r.DV = &dv
	}
	if (r.Mode == "program" || r.Mode == "zap") && r.DV == nil {
		return 0, fmt.Errorf("Укажите результат проверки защиты цели (DV)")
	}
	return rank, nil
}

var netDamageFormula = regexp.MustCompile(`^([1-8])d6$`)

func netOutcome(v map[string]any, r RollRequest, facts map[string]map[string]any, result *RollResult, die func(int) int) {
	if result.Success == nil || !*result.Success {
		return
	}
	net := object(v["netrunning"])
	node := find(net["nodes"], "uid", r.TargetNodeUID)
	if node != nil {
		switch r.Mode {
		case "backdoor":
			node["unlocked"] = true
		case "control":
			node["controlled"] = true
		case "eyedee":
			node["identified"] = true
		case "slide":
			node["pursuing"] = false
		}
	}
	formula := ""
	if r.Mode == "zap" {
		formula = "1d6"
	}
	if r.Mode == "program" {
		p := find(net["loadedPrograms"], "uid", r.EntryUID)
		f := facts[str(p["key"])]
		switch str(p["key"]) {
		case "program-sword", "program-banhammer":
			if r.TargetType == "blackIce" {
				formula = str(f["blackIceDamage"])
			} else {
				formula = str(f["standardDamage"])
			}
		case "program-hellbolt":
			formula = "2d6"
			result.Effect = "Урон мозгу; незащищённое от нагрева снаряжение загорается."
		case "program-vrizzbolt":
			formula = "1d6"
			result.Effect = "Урон мозгу; в следующий ход цель теряет одно NET-действие (минимум два)."
		case "program-deckkrash":
			result.Effect = "Цель принудительно и небезопасно отключается от архитектуры."
		case "program-poison-flatline":
			result.Effect = "Случайная программа, не являющаяся Чёрным ЛЬДОМ, уничтожается на деке цели."
		case "program-nervescrub":
			n := die(6)
			result.Effect = fmt.Sprintf("INT, REF и DEX цели уменьшены на %d (минимум 1) на один час.", n)
		case "program-superglue":
			n := die(6)
			result.Effect = fmt.Sprintf("Цель не может продвигаться в архитектуре и безопасно отключиться %d раундов.", n)
		}
	}
	if match := netDamageFormula.FindStringSubmatch(formula); match != nil {
		count, _ := strconv.Atoi(match[1])
		for i := 0; i < count; i++ {
			n := die(6)
			result.DamageDice = append(result.DamageDice, n)
			result.Damage += n
		}
		if node != nil && (str(node["type"]) == "blackIce" || str(node["type"]) == "program" || str(node["type"]) == "demon") {
			node["rez"] = max(0, num(node["rez"])-result.Damage)
		}
	}
}
