package store

import (
	"context"
	"github.com/jackc/pgx/v5"
	"math"
	"strings"
)

type ImpactDamage struct {
	Amount  int    `json:"amount"`
	TypeID  int    `json:"typeId,omitempty"`
	Label   string `json:"label,omitempty"`
	Color   string `json:"color,omitempty"`
	Applied int    `json:"applied"`
	Defense string `json:"defense,omitempty"`
}
type ImpactHP struct {
	Current int `json:"current"`
	Temp    int `json:"temp"`
	Max     int `json:"max"`
}
type ImpactResult struct {
	Key            string              `json:"key"`
	Target         ApplicationTarget   `json:"target"`
	Before         ImpactHP            `json:"before"`
	After          ImpactHP            `json:"after"`
	Damage         []ImpactDamage      `json:"damage"`
	Total          int                 `json:"total"`
	Absorbed       int                 `json:"absorbed"`
	HPLost         int                 `json:"hpLost"`
	Multiplier     float64             `json:"multiplier"`
	Effects        []ApplicationEffect `json:"effects,omitempty"`
	EffectsRemoved []int               `json:"effectsRemoved,omitempty"`
	EventID        int64               `json:"eventId,omitempty"`
	Action         string              `json:"action,omitempty"`
	CreatedAt      string              `json:"createdAt,omitempty"`
}

func impactHP(doc transferDocument, maximum int) ImpactHP {
	hp := object(doc.values()["hp"])
	return ImpactHP{max(0, number(hp["current"])), max(0, number(hp["temp"])), maximum}
}
func impactDamageParts(ctx context.Context, tx pgx.Tx, data map[string]any, amount int) ([]ImpactDamage, error) {
	if data == nil {
		if amount < 1 || amount > 100000 {
			return nil, ErrApplication
		}
		return []ImpactDamage{{Amount: amount}}, nil
	}
	if data["damageRoll"] != true {
		return nil, nil
	}
	result := object(data["result"])
	total := number(result["total"])
	if total < 0 || total > 100000 {
		return nil, ErrApplication
	}
	parts := []ImpactDamage{}
	sum := 0
	for _, v := range array(result["byType"]) {
		row := object(v)
		n := number(row["value"])
		if n < 0 {
			return []ImpactDamage{{Amount: total}}, nil
		}
		label := textValue(row["label"])
		part := ImpactDamage{Amount: n, Label: label, Color: textValue(row["color"])}
		if label != "" {
			if err := tx.QueryRow(ctx, `SELECT COALESCE((SELECT id FROM dndshare.suggest WHERE type_id=12 AND lower(value)=lower($1) AND user_id IS NULL LIMIT 1),0)`, strings.TrimSpace(label)).Scan(&part.TypeID); err != nil {
				return nil, err
			}
		}
		parts = append(parts, part)
		sum += n
	}
	if len(parts) == 0 || sum != total {
		parts = []ImpactDamage{{Amount: total}}
	}
	return parts, nil
}
func applyImpactDamage(doc transferDocument, parts []ImpactDamage, defenses []any, multiplier float64, maximum int) ImpactResult {
	before := impactHP(doc, maximum)
	result := ImpactResult{Before: before, After: before, Multiplier: multiplier, Damage: []ImpactDamage{}}
	for _, part := range parts {
		resistance, immune, vulnerable := false, false, false
		for _, v := range defenses {
			r := object(v)
			if part.TypeID == 0 || number(r["damage_type"]) != part.TypeID {
				continue
			}
			switch r["kind"] {
			case "", "resistance":
				resistance = true
			case "immunity":
				immune = true
			case "vulnerability":
				vulnerable = true
			}
		}
		part.Applied = int(math.Floor(float64(part.Amount) * multiplier))
		if immune {
			part.Applied = 0
			part.Defense = "immunity"
		} else {
			if resistance {
				part.Applied /= 2
				part.Defense = "resistance"
			}
			if vulnerable {
				part.Applied *= 2
				if resistance {
					part.Defense = "resistance_vulnerability"
				} else {
					part.Defense = "vulnerability"
				}
			}
		}
		result.Total += part.Applied
		result.Damage = append(result.Damage, part)
	}
	result.Absorbed = min(before.Temp, result.Total)
	result.HPLost = min(before.Current, result.Total-result.Absorbed)
	result.After.Temp -= result.Absorbed
	result.After.Current -= result.HPLost
	if len(parts) == 0 {
		return result
	}
	hp := object(doc.values()["hp"])
	hp["current"] = result.After.Current
	hp["temp"] = result.After.Temp
	doc.values()["hp"] = hp
	return result
}
