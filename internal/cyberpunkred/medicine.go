package cyberpunkred

import "fmt"

func medicineCheck(v map[string]any, r *RollRequest) (int, error) {
	role := find(v["roles"], "key", "medtech")
	if role == nil {
		return 0, fmt.Errorf("Требуется роль Медтехника")
	}
	choices := object(role["choices"])
	tech := num(object(v["stats"])["TECH"])
	medical := num(choices["pharmaceuticals"]) + num(choices["cryosystem"])
	if r.Kind == "manufacture-medicine" {
		if !isMedicine(r.EntryUID) {
			return 0, fmt.Errorf("Неизвестный препарат")
		}
		if num(choices["pharmaceuticals"]) < 1 {
			return 0, fmt.Errorf("Нет фармацевтической специальности")
		}
		known := false
		for _, key := range array(choices["knownRecipes"]) {
			if str(key) == r.EntryUID {
				known = true
			}
		}
		if !known {
			return 0, fmt.Errorf("Рецепт не изучен")
		}
		economy := object(v["economy"])
		if num(economy["cashEb"]) < 200 {
			return 0, fmt.Errorf("Для материалов нужно 200 eb")
		}
		economy["cashEb"] = num(economy["cashEb"]) - 200
		dv := 13
		r.DV = &dv
		return tech + medical, nil
	}
	if r.Mode == "surgery" {
		if num(choices["surgery"]) < 1 {
			return 0, fmt.Errorf("Нет хирургической специальности")
		}
		return tech + 2*num(choices["surgery"]), nil
	}
	if medical < 1 {
		return 0, fmt.Errorf("Нет навыка Медицинские технологии")
	}
	return tech + medical, nil
}
func medicineOutcome(v map[string]any, r RollRequest, result *RollResult) {
	if result.Success == nil || !*result.Success {
		result.Effect = "Проверка не пройдена; материалы потрачены."
		return
	}
	choices := object(find(v["roles"], "key", "medtech")["choices"])
	doses := num(choices["pharmaceuticals"]) + num(choices["cryosystem"])
	inventory := object(v["inventory"])
	inventory["entries"] = append(array(inventory["entries"]), map[string]any{"uid": r.ActionID, "key": r.EntryUID, "count": doses, "equipped": false})
	v["inventory"] = inventory
	result.Effect = fmt.Sprintf("Изготовлено %d доз; затрачены 200 eb и 1 час работы.", doses)
}
