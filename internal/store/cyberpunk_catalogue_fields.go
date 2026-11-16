package store

import (
	"dndshare/internal/cyberpunkred"
	"sort"
)

var redFactLabels = map[string]string{
	"ignoreSPBelow": "Игнорирует SP ниже", "autofireAmmo": "Патронов за автоогонь", "autofireOnly": "Только автоогонь", "noAimed": "Без прицельных атак", "noCritical": "Не вызывает критических травм", "nonlethal": "Нелетальное", "bodyRequired": "Требуется BODY без станка", "reloadActions": "Действий перезарядки", "injuryRoll": "Результат 2d6",
	"perception": "Восприятие", "speed": "Скорость", "target": "Тип цели", "interface": "Интерфейс", "netActions": "NET-действия", "combatNumber": "Боевое число", "addictionDV": "DV зависимости",
	"manufactureDV": "DV изготовления", "batchCost": "Материалы на партию, eb", "hours": "Время, часы", "rent": "Аренда в месяц, eb", "buy": "Стоимость покупки, eb", "monthlyCost": "Расход в месяц, eb", "blackIceDamage": "Урон по Чёрному ЛЬДУ", "standardDamage": "Урон по обычным программам",
	"paired": "Требует парной установки",
	"price":  "Цена, eb", "quantity": "Количество в упаковке", "damage": "Урон", "skill": "Навык",
	"weaponType": "Вид оружия", "rof": "Темп огня", "hands": "Количество рук", "ranged": "Дальнобойное",
	"quality": "Качество", "magazine": "Вместимость магазина", "ammo": "Совместимые боеприпасы",
	"autofire": "Множитель автоогня", "suppressiveFire": "Огонь на подавление", "conceal": "Можно скрыть",
	"ignoreArmorPercent": "Игнорирование брони, %", "headSP": "SP головы", "bodySP": "SP тела",
	"penalty": "Штраф брони", "shieldHP": "HP щита", "cyberCategory": "Категория импланта",
	"foundation": "Базовая установка", "slots": "Слоты", "size": "Занимает слотов", "humanity": "Потеря Humanity при создании",
	"humanityRoll": "Потеря Humanity после создания", "surgery": "Место установки", "weapon": "Кибероружие",
	"programClass": "Класс программы", "atk": "Атака", "defense": "Защита", "rez": "REZ",
	"ammoType": "Тип боеприпаса", "ammoVariety": "Калибр / совместимость", "ablation": "Износ SP",
	"sdp": "SDP", "seats": "Места", "move": "Перемещение", "upgradeType": "Вид модификации",
	"location": "Локализация", "deathPenalty": "Штраф проверки смерти", "firstAidDV": "DV первой помощи",
	"paramedicDV": "DV парамедицины", "treatmentParamedicDV": "DV лечения", "surgeryDV": "DV хирургии",
	"roleKey": "Способность роли", "startingRank": "Начальный ранг",
}

func redCatalogueFields(items []cyberpunkred.CatalogueItem, category string) []map[string]any {
	kind := ""
	for _, item := range items {
		if item.Category == category {
			kind = item.Kind
			break
		}
	}
	core, _ := cyberpunkred.Core()
	dictionaries := map[string]string{"skill": "Навыки", "quality": "Качество оружия", "surgery": "Места установки", "location": "Локализации", "weaponType": "Типы оружия", "ammoType": "Типы боеприпасов", "ammoVariety": "Калибры и совместимость", "cyberCategory": "Категории киберимплантов", "programClass": "Классы программ"}
	types := map[string]string{}
	for _, item := range items {
		if item.Category != category {
			continue
		}
		for key, value := range item.Facts {
			typ := "text"
			switch value.(type) {
			case float64:
				typ = "int"
			case bool:
				typ = "bool"
			case []any:
				typ = "text_array"
			}
			types[key] = typ
		}
	}
	keys := []string{}
	for key := range types {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	facts := []map[string]any{}
	for _, key := range keys {
		if key == "bonuses" {
			facts = append(facts, map[string]any{"key": key, "name": "Бонусы", "type": "object_array", "fields": []map[string]any{{"key": "target", "name": "Область", "type": "text"}, {"key": "phase", "name": "Фаза препарата", "type": "text", "optional": true}, {"key": "value", "name": "Значение", "type": "int"}, {"key": "conditional", "name": "По условию", "type": "bool"}}})
			continue
		}
		name := redFactLabels[key]
		if name == "" {
			name = key
		}
		field := map[string]any{"key": key, "name": name, "type": types[key], "optional": true}
		if rows := core.Dictionaries[dictionaries[key]]; len(rows) > 0 {
			options := []map[string]any{}
			for _, r := range rows {
				options = append(options, map[string]any{"value": r.Key, "label": r.Name})
			}
			field["type"] = "select"
			field["options"] = options
		}
		facts = append(facts, field)
	}
	return []map[string]any{
		{"key": "description", "name": "Справка", "type": "description"},
		{"key": "facts", "name": "Параметры RED", "type": "object", "fields": facts},
		{"key": "red_key", "name": "Ключ записи", "type": "text", "readonly": true},
		{"key": "red_kind", "name": "Категория данных", "type": "text", "readonly": true, "default": kind},
		{"key": "red_revision", "name": "Версия источника", "type": "text", "readonly": true, "default": core.Revision},
	}
}
