package web

import (
	"fmt"
	"strconv"
	"strings"
)

func mapSaveShortNameToKey(shortName string) string {
	s := strings.TrimRight(strings.ToLower(strings.TrimSpace(shortName)), ".")
	switch s {
	case "сил":
		return "str"
	case "лвк", "лов":
		return "dex"
	case "тел":
		return "con"
	case "инт":
		return "int"
	case "мдр":
		return "wis"
	case "хар":
		return "cha"
	case "str", "dex", "con", "int", "wis", "cha":
		return s
	}
	return ""
}

func buildHpFormula(hits any) string {
	formula := jStr(jPath(hits, "formula"), "")
	if formula == "" {
		return ""
	}
	sign := strings.TrimSpace(jStr(jPath(hits, "sign"), ""))
	bonus := jInt(jPath(hits, "bonus"), 0)
	if bonus != 0 {
		if bonus < 0 {
			bonus = -bonus
		}
		return fmt.Sprintf("%s %s %d", formula, sign, bonus)
	}
	return formula
}

func buildSpeedData(speedNode any) (string, []any) {
	arr, ok := asAnySlice(speedNode)
	if !ok {
		return "", nil
	}
	opts := make([]any, 0, len(arr))
	parts := make([]string, 0, len(arr))
	for _, s := range arr {
		name := jStr(jPath(s, "name"), "")
		value := jInt(jPath(s, "value"), 0)
		opts = append(opts, map[string]any{"name": name, "value": value})
		if name == "" {
			parts = append(parts, fmt.Sprintf("%d фт.", value))
		} else {
			parts = append(parts, fmt.Sprintf("%s %d фт.", name, value))
		}
	}
	return strings.Join(parts, ", "), opts
}

func buildStatList(node any, useShortName bool) string {
	arr, ok := asAnySlice(node)
	if !ok {
		return ""
	}
	parts := make([]string, 0, len(arr))
	for _, s := range arr {
		var name string
		if useShortName {
			name = jStr(jPath(s, "shortName"), jStr(jPath(s, "name"), ""))
		} else {
			name = jStr(jPath(s, "name"), "")
		}
		value := jInt(jPath(s, "value"), 0)
		if value >= 0 {
			parts = append(parts, fmt.Sprintf("%s +%d", name, value))
		} else {
			parts = append(parts, fmt.Sprintf("%s %d", name, value))
		}
	}
	return strings.Join(parts, ", ")
}

func buildSenses(node any) string {
	if _, ok := asAnyMap(node); !ok {
		return ""
	}
	parts := []string{}
	if senses, ok := asAnySlice(jPath(node, "senses")); ok {
		for _, s := range senses {
			name := jStr(jPath(s, "name"), "")
			value := jInt(jPath(s, "value"), 0)
			if name != "" {
				parts = append(parts, fmt.Sprintf("%s %d фт.", name, value))
			}
		}
	}
	if passive := jStr(jPath(node, "passivePerception"), ""); passive != "" {
		parts = append(parts, "пассивное Внимательность "+passive)
	}
	return strings.Join(parts, ", ")
}

func buildBlocks(node any) []any {
	arr, ok := asAnySlice(node)
	if !ok {
		return nil
	}
	out := []any{}
	for _, a := range arr {
		name := jStr(jPath(a, "name"), "")
		value := jStr(jPath(a, "value"), "")
		if name == "" && value == "" {
			continue
		}
		out = append(out, map[string]any{"name": name, "value": value})
	}
	return out
}

func joinStringArray(node any) string {
	arr, ok := asAnySlice(node)
	if !ok {
		return ""
	}
	parts := []string{}
	for _, el := range arr {
		if s := jStr(el, ""); s != "" {
			parts = append(parts, s)
		}
	}
	return strings.Join(parts, ", ")
}

func joinNamesNonBlank(node any) string {
	arr, ok := asAnySlice(node)
	if !ok {
		return ""
	}
	parts := []string{}
	for _, el := range arr {
		if s := jStr(jPath(el, "name"), ""); s != "" {
			parts = append(parts, s)
		}
	}
	return strings.Join(parts, ", ")
}

func splitTrimNonBlank(s, sep string) []string {
	out := []string{}
	for _, part := range strings.Split(s, sep) {
		if p := strings.TrimSpace(part); p != "" {
			out = append(out, p)
		}
	}
	return out
}

// --- generic JsonNode-like accessors over map[string]any decoded json ---

func jPath(node any, keys ...string) any {
	cur := node
	for _, k := range keys {
		m, ok := cur.(map[string]any)
		if !ok {
			return nil
		}
		cur = m[k]
	}
	return cur
}

func jStr(node any, def string) string {
	switch v := node.(type) {
	case string:
		return v
	case float64:
		return strconv.FormatFloat(v, 'f', -1, 64)
	case bool:
		return strconv.FormatBool(v)
	}
	return def
}

func jInt(node any, def int) int {
	switch v := node.(type) {
	case float64:
		return int(v)
	case string:
		if n, err := strconv.Atoi(strings.TrimSpace(v)); err == nil {
			return n
		}
	}
	return def
}

func hasNonNull(node any, key string) bool {
	m, ok := node.(map[string]any)
	if !ok {
		return false
	}
	v, present := m[key]
	return present && v != nil
}
