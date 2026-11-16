package cyberpunkred

import "fmt"

func prepareAttack(v map[string]any, r *RollRequest, facts map[string]map[string]any, effective, bonuses map[string]int, solo map[string]any, result *RollResult) (int, error) {
	base := 0

	if r.Mode == "" {
		r.Mode = "single"
	}
	if r.Mode != "single" && r.Mode != "aimed" && r.Mode != "autofire" && r.Mode != "suppressive" {
		return 0, fmt.Errorf("Неизвестный режим атаки")
	}
	if r.Location != "" && r.Location != "body" && r.Location != "head" {
		return 0, fmt.Errorf("Неизвестная область попадания")
	}
	if r.Location == "head" && r.Mode != "aimed" {
		return 0, fmt.Errorf("Для попадания в голову выберите прицельную атаку")
	}
	entry := find(object(v["inventory"])["entries"], "uid", r.EntryUID)
	if entry == nil || entry["equipped"] != true {
		return 0, fmt.Errorf("Оружие не экипировано")
	}
	if entry["jammed"] == true {
		return 0, fmt.Errorf("Сначала устраните неисправность")
	}
	f, ok := facts[str(entry["key"])]
	if !ok || f["damage"] == nil {
		return 0, fmt.Errorf("Нет параметров оружия")
	}
	if f["weapon"] == true || entry["linkedCyberUid"] != nil {
		implant := find(object(v["cyberware"])["installations"], "uid", str(entry["linkedCyberUid"]))
		if implant == nil {
			return 0, fmt.Errorf("Кибероружие не установлено")
		}
		for n := 0; implant != nil; n++ {
			if implant["disabled"] == true || n > 50 {
				return 0, fmt.Errorf("Кибероружие или его основание отключено")
			}
			implant = find(object(v["cyberware"])["installations"], "uid", str(implant["parentUid"]))
		}
	}
	if f["autofireOnly"] == true && r.Mode != "autofire" {
		return 0, fmt.Errorf("Это оружие использует только автоогонь")
	}
	if r.Mode == "aimed" && (f["noAimed"] == true || str(f["weaponType"]) == "grenadeLauncher" || str(f["weaponType"]) == "rocketLauncher") {
		return 0, fmt.Errorf("Это оружие не поддерживает прицельную атаку")
	}
	if required := num(f["bodyRequired"]); required > effective["BODY"] && entry["mounted"] != true {
		return 0, fmt.Errorf("Требуется BODY 11 или установка на станке")
	}
	skillKey := str(f["skill"])
	spend := 0
	if f["ranged"] == true {
		spend = 1
		base += effective["REF"]
	} else {
		base += effective["DEX"]
	}
	if r.Mode == "autofire" || r.Mode == "suppressive" {
		if num(f["autofire"]) <= 0 {
			return 0, fmt.Errorf("Этот режим недоступен")
		}
		spend = 10
		if num(f["autofireAmmo"]) > 0 {
			spend = num(f["autofireAmmo"])
		}
		skillKey = "autofire"
	}
	ammo := find(object(v["inventory"])["entries"], "uid", str(entry["ammoUid"]))
	ammoFacts := facts[str(ammo["key"])]
	if str(entry["key"]) == "weapon-dartgun" && str(ammoFacts["ammoType"]) == "basic" {
		return 0, fmt.Errorf("Дартган не использует Basic ammunition")
	}
	if r.Mode == "aimed" && str(ammoFacts["ammoVariety"]) == "shotgunShell" {
		return 0, fmt.Errorf("Дробью нельзя выполнить прицельный выстрел")
	}
	if r.Distance != nil && r.DV == nil && f["ranged"] == true && r.Mode != "suppressive" {
		dv, err := RangeDV(str(f["weaponType"]), *r.Distance, r.Mode == "autofire")
		if err != nil {
			return 0, err
		}
		if str(ammoFacts["ammoVariety"]) == "shotgunShell" {
			if *r.Distance > 6 {
				return 0, fmt.Errorf("Дробь действует в пределах 6 метров")
			}
			dv = 13
		}
		r.DV = &dv
	}
	foundSkill := false
	for _, skill := range array(v["skills"]) {
		s := object(skill)
		if str(s["key"]) == skillKey && (r.SkillUID == "" || r.SkillUID == str(s["uid"])) {
			base += num(s["rank"])
			foundSkill = num(s["rank"]) > 0
			break
		}
	}
	if skillKey == "martial-arts" && !foundSkill {
		return 0, fmt.Errorf("Требуется хотя бы один ранг выбранного боевого искусства")
	}
	if skillKey == "athletics" && f["ranged"] == true {
		base += effective["DEX"] - effective["REF"]
	}
	if str(f["quality"]) == "excellent" {
		base++
	}
	base += num(solo["precisionAttack"])
	if f["ranged"] == true {
		base += bonuses["ranged"]
	} else {
		base += bonuses["melee"]
	}
	if r.Mode == "single" {
		base += bonuses["single-shot"]
	}
	base += bonuses[skillKey]
	if r.Mode == "aimed" {
		base -= 8
		base += bonuses["aimed"]
	}
	if num(f["magazine"]) > 0 {
		if num(entry["loaded"]) < spend {
			return 0, fmt.Errorf("Не хватает патронов")
		}
		entry["loaded"] = num(entry["loaded"]) - spend
		result.AmmoSpent = spend
	}
	return base, nil
}
