package documentpatch

import (
	"encoding/json"
	"sort"
)

func raw(value any) json.RawMessage   { data, _ := json.Marshal(value); return data }
func step(path []any, part any) []any { return append(append([]any{}, path...), part) }
func Diff(before, after json.RawMessage) ([]Operation, error) {
	a, err := Decode(before)
	if err != nil {
		return nil, err
	}
	b, err := Decode(after)
	if err != nil {
		return nil, err
	}
	return diff(a, b, []any{}), nil
}
func diff(a, b any, path []any) []Operation {
	changes := diffNode(a, b, path)
	if len(changes) > 10000 {
		return []Operation{{Op: "set", Path: path, Value: raw(b)}}
	}
	return changes
}
func diffNode(a, b any, path []any) []Operation {
	if Equal(a, b) {
		return []Operation{}
	}
	old, aObject := a.(map[string]any)
	next, bObject := b.(map[string]any)
	if aObject && bObject {
		keys := map[string]bool{}
		for key := range old {
			keys[key] = true
		}
		for key := range next {
			keys[key] = true
		}
		ordered := []string{}
		for key := range keys {
			ordered = append(ordered, key)
		}
		sort.Strings(ordered)
		changes := []Operation{}
		for _, key := range ordered {
			x, had := old[key]
			y, has := next[key]
			p := step(path, key)
			if !has {
				changes = append(changes, Operation{Op: "remove", Path: p})
			} else if !had {
				changes = append(changes, Operation{Op: "set", Path: p, Value: raw(y)})
			} else {
				changes = append(changes, diff(x, y, p)...)
			}
		}
		return changes
	}
	before, aList := a.([]any)
	after, bList := b.([]any)
	if aList && bList {
		if key := collectionKey(before, after); key != "" {
			return diffCollection(before, after, path, key)
		}
	}
	return []Operation{{Op: "set", Path: path, Value: raw(b)}}
}
func collectionKey(a, b []any) string {
	if len(a)+len(b) == 0 {
		return ""
	}
	for _, key := range []string{"uid", "id", "key", "charId"} {
		valid := true
		for _, list := range [][]any{a, b} {
			seen := map[string]bool{}
			for _, item := range list {
				object, ok := item.(map[string]any)
				if !ok || !validID(object[key]) || seen[string(raw(object[key]))] {
					valid = false
					break
				}
				seen[string(raw(object[key]))] = true
			}
		}
		if valid {
			return key
		}
	}
	return ""
}
func diffCollection(before, after []any, path []any, key string) []Operation {
	old, next := map[string]map[string]any{}, map[string]map[string]any{}
	for _, item := range before {
		object := item.(map[string]any)
		old[string(raw(object[key]))] = object
	}
	for _, item := range after {
		object := item.(map[string]any)
		next[string(raw(object[key]))] = object
	}
	changes := []Operation{}
	for _, item := range before {
		object := item.(map[string]any)
		if next[string(raw(object[key]))] == nil {
			changes = append(changes, Operation{Op: "remove", Path: step(path, Selector{key, object[key]})})
		}
	}
	for i := len(after) - 1; i >= 0; i-- {
		object := after[i].(map[string]any)
		previous := old[string(raw(object[key]))]
		p := step(path, Selector{key, object[key]})
		if previous == nil {
			op := Operation{Op: "insert", Path: p, Value: raw(object)}
			if i+1 < len(after) {
				op.BeforeID = raw(after[i+1].(map[string]any)[key])
			}
			changes = append(changes, op)
		} else {
			changes = append(changes, diff(previous, object, p)...)
		}
	}
	oldOrder, newOrder, allOrder := []any{}, []any{}, []any{}
	for _, item := range before {
		id := item.(map[string]any)[key]
		if next[string(raw(id))] != nil {
			oldOrder = append(oldOrder, id)
		}
	}
	for _, item := range after {
		id := item.(map[string]any)[key]
		allOrder = append(allOrder, id)
		if old[string(raw(id))] != nil {
			newOrder = append(newOrder, id)
		}
	}
	if !Equal(oldOrder, newOrder) {
		changes = append(changes, Operation{Op: "order", Path: path, IDField: key, Value: raw(allOrder)})
	}
	return changes
}
