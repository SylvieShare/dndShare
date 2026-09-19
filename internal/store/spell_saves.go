package store

func spellSaveEvent(data, values map[string]any, ability int, spellID int64, entryKey string) map[string]any {
	rule := object(data["damage"])
	if rule["save_manual"] == true {
		return nil
	}
	id := map[string]int{"str": 1, "dex": 2, "con": 3, "int": 4, "wis": 5, "cha": 6}[textValue(rule["save_ability"])]
	if id == 0 {
		return nil
	}
	dc := calculatedSpellSaveDC(values, ability, spellID, entryKey)
	if fixed := number(rule["save_dc"]); fixed > 0 && fixed <= 100 {
		dc = fixed
	}
	return map[string]any{"ability": id, "dc": dc, "onSuccess": rule["save_effect"], "condition": rule["save_condition"], "results": []any{}}
}

func calculatedSpellSaveDC(values map[string]any, ability int, spellID int64, entryKey string) int {
	profData := object(values["prof_bonus"])
	prof := 2 + max(0, number(object(values["lvl"])["level"])-1)/4
	if profData["auto"] == false {
		prof = number(profData["v"])
	}
	for _, row := range array(profData["bonuses"]) {
		prof += number(object(row)["value"])
	}
	extra := 0
	for _, raw := range array(object(values["spells"])["tabs"]) {
		tab := object(raw)
		for _, value := range array(tab["spells"]) {
			entry := object(value)
			if number(entry["id"]) == int(spellID) && (entryKey == "" || textValue(entry["key"]) == entryKey) {
				extra = number(tab["save_bonus"])
			}
		}
	}
	return 8 + prof + spellAbilityModifier(values, ability) + extra
}
