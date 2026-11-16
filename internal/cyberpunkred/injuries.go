package cyberpunkred

import (
	"encoding/json"
	"fmt"
)

func rollInjury(doc map[string]any, r RollRequest, die func(int) int) (json.RawMessage, RollResult, error) {
	result := RollResult{Title: r.Title, Expression: "2d6", DiceSides: 6}
	if r.Location != "body" && r.Location != "head" {
		return nil, result, fmt.Errorf("Выберите таблицу травм")
	}
	v := object(doc["values"])
	health := object(v["health"])
	core, err := Core()
	if err != nil {
		return nil, result, err
	}
	available := map[int]CatalogueItem{}
	for _, item := range core.Items {
		if item.Kind == "criticalInjury" && item.Facts["location"] == r.Location && find(health["injuries"], "key", item.Key) == nil {
			available[num(item.Facts["injuryRoll"])] = item
		}
	}
	if len(available) == 0 {
		return nil, result, fmt.Errorf("Все травмы этой таблицы уже есть; требуется решение ведущего")
	}
	for i := 0; i < 100; i++ {
		a, b := die(6), die(6)
		item, ok := available[a+b]
		if !ok {
			continue
		}
		result.Dice = []int{a, b}
		result.Total = a + b
		result.Title = item.Name
		result.Effect = item.Summary
		health["injuries"] = append(array(health["injuries"]), map[string]any{"uid": r.ActionID, "key": item.Key})
		next, err := json.Marshal(doc)
		return next, result, err
	}
	return nil, result, fmt.Errorf("Не удалось выбрать новую травму; повторите бросок")
}
