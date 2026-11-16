package cyberpunkred

import (
	"encoding/json"
	"fmt"
	"math"
)

// ValidateDocument enforces the RED document shape, not a particular GM's house rules.
func ValidateDocument(raw json.RawMessage) error {
	var doc map[string]any
	if json.Unmarshal(raw, &doc) != nil {
		return fmt.Errorf("Некорректный документ персонажа")
	}
	if doc["system"] != "cyberpunk-red" {
		return nil
	}
	if num(doc["schemaVersion"]) != 1 {
		return fmt.Errorf("Неизвестная версия листа RED")
	}
	v := object(doc["values"])
	validInt := func(value any, min, max int) bool {
		n, ok := value.(float64)
		return ok && !math.IsNaN(n) && math.Trunc(n) == n && n >= float64(min) && n <= float64(max)
	}
	for _, k := range []string{"INT", "REF", "DEX", "TECH", "COOL", "WILL", "LUCK", "MOVE", "BODY", "EMP"} {
		if !validInt(object(v["stats"])[k], 0, 100) {
			return fmt.Errorf("Некорректная характеристика %s", k)
		}
	}
	for _, k := range []string{"health", "humanity", "luck"} {
		if !validInt(object(v[k])["current"], -1000, 100000) {
			return fmt.Errorf("Некорректный ресурс %s", k)
		}
	}
	core, err := Core()
	if err != nil {
		return err
	}
	skillKeys := map[string]bool{}
	for _, s := range core.Dictionaries["Навыки"] {
		skillKeys[s.Key] = true
	}
	for _, section := range []string{"skills", "roles"} {
		rows, ok := v[section].([]any)
		if !ok || len(rows) > 1000 {
			return fmt.Errorf("Некорректный список %s", section)
		}
		uids := map[string]bool{}
		for _, raw := range rows {
			e := object(raw)
			uid := str(e["uid"])
			if uid == "" || uids[uid] || !validInt(e["rank"], 0, 10) {
				return fmt.Errorf("Некорректный ранг или идентификатор в %s", section)
			}
			uids[uid] = true
			if section == "skills" && !skillKeys[str(e["key"])] {
				return fmt.Errorf("Неизвестный навык RED")
			}
		}
	}
	for _, raw := range array(v["roles"]) {
		r := object(raw)
		rank := num(r["rank"])
		c := object(r["choices"])
		costs := map[string]int{}
		switch str(r["key"]) {
		case "solo":
			costs = map[string]int{"damageDeflection": 2, "fumbleRecovery": 4, "initiative": 1, "precisionAttack": 3, "spotWeakness": 1, "threatDetection": 1}
		case "tech":
			costs = map[string]int{"field": 1, "upgrade": 1, "fabrication": 1, "invention": 1}
			rank *= 2
		case "medtech":
			costs = map[string]int{"surgery": 1, "pharmaceuticals": 1, "cryosystem": 1}
		case "rockerboy", "netrunner", "media", "exec", "lawman", "fixer", "nomad":
		default:
			return fmt.Errorf("Неизвестная роль RED")
		}
		total := 0
		for k, cost := range costs {
			if c[k] == nil {
				continue
			}
			limit := 10
			if str(r["key"]) == "tech" {
				limit = num(r["rank"])
			}
			if str(r["key"]) == "medtech" {
				limit = 5
			}
			if k == "fumbleRecovery" {
				limit = 1
			}
			if !validInt(c[k], 0, limit) {
				return fmt.Errorf("Неверное распределение способности роли")
			}
			total += num(c[k]) * cost
		}
		if total > rank {
			return fmt.Errorf("Превышен бюджет способности роли")
		}
		if str(r["key"]) == "medtech" {
			known := map[string]bool{}
			for _, key := range array(c["knownRecipes"]) {
				k := str(key)
				if known[k] || !isMedicine(k) {
					return fmt.Errorf("Неизвестный или повторный рецепт")
				}
				known[k] = true
			}
			if len(known) > num(c["pharmaceuticals"]) {
				return fmt.Errorf("Слишком много рецептов")
			}
		}
	}
	if e := object(v["economy"]); e["cashEb"] != nil && !validInt(e["cashEb"], 0, 1000000000) {
		return fmt.Errorf("Некорректная сумма евробаксов")
	}
	for _, section := range []struct{ block, field string }{{"inventory", "entries"}, {"cyberware", "installations"}, {"netrunning", "loadedPrograms"}} {
		rows := array(object(v[section.block])[section.field])
		if len(rows) > 5000 {
			return fmt.Errorf("Слишком много записей %s", section.block)
		}
		seen := map[string]bool{}
		for _, raw := range rows {
			e := object(raw)
			uid := str(e["uid"])
			if uid == "" || seen[uid] || str(e["key"]) == "" {
				return fmt.Errorf("Некорректная запись %s", section.block)
			}
			seen[uid] = true
			for _, field := range []string{"count", "loaded", "rez"} {
				if e[field] != nil && !validInt(e[field], 0, 100000) {
					return fmt.Errorf("Некорректное количество %s", field)
				}
			}
		}
	}
	return nil
}

func isMedicine(key string) bool {
	switch key {
	case "pharma-antibiotic", "pharma-rapid-detox", "pharma-speedheal", "pharma-stim", "pharma-surge":
		return true
	}
	return false
}
