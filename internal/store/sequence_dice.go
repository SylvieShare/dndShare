package store

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

var sequenceTerm = regexp.MustCompile(`([+-])((?:\d*)d\d+|\d+)(?:\{([^|}]*)(?:\|([^}]*))?\})?`)

// The same bounded, typed additive expression used by spell previews. No code,
// multiplication or arbitrary expressions are evaluated on the server.
func rollSequenceDice(expression string, roll func(int) (int, error)) (map[string]any, error) {
	f := strings.TrimSpace(expression)
	if len(f) == 0 || len(f) > 2000 {
		return nil, ErrApplication
	}
	if f[0] != '+' && f[0] != '-' {
		f = "+" + f
	}
	parts := []any{}
	pos, diceCount := 0, 0
	for _, match := range sequenceTerm.FindAllStringSubmatchIndex(f, -1) {
		if match[0] != pos {
			return nil, ErrApplication
		}
		pos = match[1]
		value := func(i int) string {
			if match[i*2] < 0 {
				return ""
			}
			return f[match[i*2]:match[i*2+1]]
		}
		body := value(2)
		part := map[string]any{"sign": value(1), "operator": value(1), "label": value(3), "color": value(4)}
		if strings.Contains(body, "d") {
			bits := strings.Split(body, "d")
			count := 1
			if bits[0] != "" {
				count, _ = strconv.Atoi(bits[0])
			}
			sides, _ := strconv.Atoi(bits[1])
			diceCount += count
			if count < 1 || diceCount > 100 || sides < 2 || sides > 100 {
				return nil, ErrApplication
			}
			rolls, sum := []any{}, 0
			for range count {
				n, err := roll(sides)
				if err != nil {
					return nil, err
				}
				rolls = append(rolls, n)
				sum += n
			}
			part["kind"], part["sides"], part["n"], part["rolls"], part["sum"] = "dice", sides, count, rolls, sum
		} else {
			n, err := strconv.Atoi(body)
			if err != nil || n > 10000 {
				return nil, ErrApplication
			}
			part["kind"], part["value"], part["sum"] = "flat", n, n
		}
		parts = append(parts, part)
	}
	if pos != len(f) || len(parts) == 0 || len(parts) > 100 {
		return nil, ErrApplication
	}
	result := map[string]any{"parts": parts, "expression": expression}
	sequenceTotals(result)
	return result, nil
}

func sequenceTotals(result map[string]any) {
	total, byType, indices := 0, []any{}, map[string]int{}
	for _, raw := range array(result["parts"]) {
		part := object(raw)
		n := number(part["sum"])
		if part["sign"] == "-" {
			n = -n
		}
		total += n
		label := textValue(part["label"])
		index, ok := indices[label]
		if !ok {
			index = len(byType)
			indices[label] = index
			byType = append(byType, map[string]any{"label": label, "color": part["color"], "value": 0})
		}
		row := object(byType[index])
		row["value"] = number(row["value"]) + n
	}
	result["total"], result["byType"] = total, byType
}

func sequenceNatural(result map[string]any) int {
	for _, raw := range array(result["parts"]) {
		part := object(raw)
		if part["kind"] != "dice" || number(part["sides"]) != 20 {
			continue
		}
		rolls := array(part["rolls"])
		index := number(part["keptIndex"])
		if index >= 0 && index < len(rolls) {
			return number(rolls[index])
		}
	}
	return 0
}

func sequenceAttack(seq map[string]any, mode string, roll func(int) (int, error)) (map[string]any, error) {
	count := 1
	if mode == "advantage" || mode == "disadvantage" {
		count = 2
	}
	bonus := number(seq["attackBonus"])
	if bonus < -100 || bonus > 100 {
		return nil, ErrApplication
	}
	expr := fmt.Sprintf("%dd20%+d", count, bonus)
	if extra := textValue(seq["attackBonusFormula"]); extra != "" {
		expr += "+" + strings.ReplaceAll(extra, " ", "")
	}
	result, err := rollSequenceDice(expr, roll)
	if err != nil {
		return nil, err
	}
	if count == 2 {
		part := object(array(result["parts"])[0])
		dice := array(part["rolls"])
		index := 0
		if mode == "advantage" && number(dice[1]) > number(dice[0]) || mode == "disadvantage" && number(dice[1]) < number(dice[0]) {
			index = 1
		}
		part["keptIndex"], part["sum"] = index, dice[index]
		sequenceTotals(result)
	}
	result["rollMode"] = mode
	return result, nil
}

func sequenceExpression(result map[string]any) string {
	terms := []string{}
	for i, raw := range array(result["parts"]) {
		p := object(raw)
		term := strconv.Itoa(number(p["value"]))
		if p["kind"] == "dice" {
			term = fmt.Sprintf("%dd%d", number(p["n"]), number(p["sides"]))
		}
		if label := textValue(p["label"]); label != "" {
			term += "{" + label
			if color := textValue(p["color"]); color != "" {
				term += "|" + color
			}
			term += "}"
		}
		sign := textValue(p["sign"])
		if sign == "" {
			sign = "+"
		}
		if i == 0 && sign == "+" {
			sign = ""
		}
		terms = append(terms, sign+term)
	}
	return strings.Join(terms, "")
}
