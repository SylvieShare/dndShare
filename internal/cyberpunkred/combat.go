package cyberpunkred

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
)

var damageFormula = regexp.MustCompile(`^(\d+)d6$`)

// RangeDV uses metres; zero entries are outside the weapon's range.
func RangeDV(weapon string, distance int, autofire bool) (int, error) {
	if weapon == "thrownWeapon" {
		if distance > 25 {
			return 0, fmt.Errorf("Предмет можно бросить не дальше 25 метров")
		}
		weapon = "grenadeLauncher"
	}
	ranges := []int{6, 12, 25, 50, 100, 200, 400, 800}
	tables := map[string][]int{
		"medPistol": {13, 15, 20, 25, 30, 30, 0, 0}, "heavyPistol": {13, 15, 20, 25, 30, 30, 0, 0}, "vHeavyPistol": {13, 15, 20, 25, 30, 30, 0, 0},
		"smg": {15, 13, 15, 20, 25, 25, 30, 0}, "heavySmg": {15, 13, 15, 20, 25, 25, 30, 0},
		"shotgun": {13, 15, 20, 25, 30, 35, 0, 0}, "assaultRifle": {17, 16, 15, 13, 15, 20, 25, 30},
		"sniperRifle": {30, 25, 25, 20, 15, 16, 17, 20}, "bow": {15, 13, 15, 17, 20, 22, 0, 0}, "crossbow": {15, 13, 15, 17, 20, 22, 0, 0},
		"grenadeLauncher": {16, 15, 15, 17, 20, 22, 25, 0}, "rocketLauncher": {17, 16, 15, 15, 20, 20, 25, 30},
	}
	if autofire {
		tables = map[string][]int{"smg": {20, 17, 20, 25, 30}, "heavySmg": {20, 17, 20, 25, 30}, "assaultRifle": {22, 20, 17, 20, 25}}
	}
	row := tables[weapon]
	if distance < 0 {
		return 0, fmt.Errorf("Расстояние не может быть отрицательным")
	}
	for i, limit := range ranges {
		if distance <= limit {
			if i < len(row) && row[i] > 0 {
				return row[i], nil
			}
			break
		}
	}
	return 0, fmt.Errorf("Цель вне табличной дальности этого оружия; уточните дистанцию или результат защиты")
}

func attackDamage(doc map[string]any, r RollRequest, facts map[string]map[string]any, die func(int) int) (json.RawMessage, RollResult, error) {
	result := RollResult{Title: r.Title, Dice: []int{}, DamageOptions: map[string]any{"location": "body", "armorMode": "full", "ablation": 1}}
	fail := func(message string) (json.RawMessage, RollResult, error) {
		return nil, result, fmt.Errorf("%s", message)
	}
	v := object(doc["values"])
	entry := find(object(v["inventory"])["entries"], "uid", r.EntryUID)
	if entry == nil {
		return fail("Оружие не найдено")
	}
	attack := object(entry["lastAttack"])
	if len(attack) == 0 || attack["damageResolved"] == true {
		return fail("Сначала выполните новую атаку")
	}
	if str(attack["mode"]) == "suppressive" {
		return fail("Подавление не наносит урон; цели проверяют Концентрацию")
	}
	if attack["dv"] != nil && num(attack["margin"]) <= 0 {
		return fail("Атака не превысила защиту цели")
	}
	f := facts[str(entry["key"])]
	formula := str(f["damage"])
	if str(f["weaponType"]) == "unarmed" || str(f["weaponType"]) == "martialArts" {
		body := num(attack["body"])
		count := 1
		if body >= 11 {
			count = 4
		} else if body >= 7 {
			count = 3
		} else if body >= 5 {
			count = 2
		}
		if str(f["weaponType"]) == "unarmed" {
			for _, raw := range array(object(v["cyberware"])["installations"]) {
				e := object(raw)
				if e["key"] == "cyberware-cyberarm" && e["disabled"] != true {
					count = max(2, count)
				}
			}
		}
		formula = fmt.Sprintf("%dd6", count)
	}
	ammo := facts[str(attack["ammoKey"])]
	ammoType := str(ammo["ammoType"])
	if num(f["ignoreArmorPercent"]) >= 50 {
		result.DamageOptions["armorMode"] = "half"
	}
	if n := num(f["ignoreSPBelow"]); n > 0 && (str(entry["key"]) != "weapon-kendachi-mono-three" || entry["biometricKey"] == true) {
		result.DamageOptions["ignoreSPBelow"] = n
	}
	if str(attack["location"]) == "head" {
		result.DamageOptions["location"] = "head"
	}
	if ammo["ablation"] != nil {
		result.DamageOptions["ablation"] = num(ammo["ablation"])
	}
	multiplier := 1
	if str(attack["mode"]) == "autofire" {
		if attack["dv"] == nil {
			return fail("Для урона автоогня укажите DV при атаке")
		}
		formula = "2d6"
		multiplier = min(num(f["autofire"]), num(attack["margin"]))
	}
	if str(ammo["ammoVariety"]) == "shotgunShell" {
		formula = "3d6"
	}
	switch ammoType {
	case "acid":
		formula = "0"
		result.DamageOptions["ablationOnly"] = true
		result.Effect = "Кислота снижает SP поражённой брони на 1 без потери HP."
	case "smoke", "flashbang", "teargas", "emp":
		formula = "0"
		result.DamageOptions["ablation"] = 0
		result.Effect = "Боеприпас не наносит обычного урона. Примените специальный эффект и проверку цели по карточке боеприпаса."
	case "rubber":
		result.DamageOptions["nonlethal"] = true
		result.DamageOptions["ablation"] = 0
	case "poison", "biotoxin", "sleep":
		formula = "0"
		result.DamageOptions["armorMode"] = "ignore"
		result.DamageOptions["ablation"] = 0
		result.Effect = "Попадание доставляет вещество. Цель отдельно проверяет Сопротивление пыткам/наркотикам: DV 13 для яда/снотворного, DV 15 для биотоксина; при провале яд наносит 2d6, биотоксин 3d6 без брони, снотворное усыпляет на минуту."
	case "incendiary":
		result.Effect = "При пробитии цель горит: 2 HP в конце своего хода без брони, пока не потратит действие на тушение."
	case "expansive":
		result.Effect = "Если выпала травма «Чужеродный объект», повторно бросьте травму и примените обе; дополнительные 5 HP только один раз."
	}
	if str(entry["key"]) == "weapon-stun-gun" || str(entry["key"]) == "weapon-stun-baton" {
		result.DamageOptions["nonlethal"] = true
		result.DamageOptions["ablation"] = 0
	}
	if str(entry["key"]) == "weapon-flamethrower" {
		formula = "3d6"
		result.Effect = "При пробитии цель горит: 4 HP в конце хода без брони, пока не потратит действие на тушение."
	}
	count := 0
	if m := damageFormula.FindStringSubmatch(formula); m != nil {
		count, _ = strconv.Atoi(m[1])
	} else if formula != "0" {
		return fail("Неподдерживаемая формула урона оружия")
	}
	if count < 0 || count > 20 {
		return fail("Недопустимое число костей урона")
	}
	sixes := 0
	for i := 0; i < count; i++ {
		d := die(6)
		if d < 1 || d > 6 {
			return fail("Ошибка генератора кубиков")
		}
		result.Dice = append(result.Dice, d)
		result.Total += d
		if d == 6 {
			sixes++
		}
	}
	result.Total *= multiplier
	combat := object(v["combat"])
	solo := object(find(v["roles"], "key", "solo")["choices"])
	if count > 0 && combat["spotWeaknessUsed"] != true && num(solo["spotWeakness"]) > 0 {
		result.Base = num(solo["spotWeakness"])
		result.Total += result.Base
		combat["spotWeaknessUsed"] = true
		v["combat"] = combat
	}
	result.DamageOptions["critical"] = sixes >= 2 && result.DamageOptions["nonlethal"] != true && f["noCritical"] != true
	result.Damage = result.Total
	result.DamageDice = result.Dice
	result.Expression = formula
	if multiplier > 1 {
		result.Expression += fmt.Sprintf(" × %d", multiplier)
	}
	if result.Base > 0 {
		result.Expression += fmt.Sprintf(" + %d", result.Base)
	}
	attack["damageResolved"] = true
	next, err := json.Marshal(doc)
	return next, result, err
}
